/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VAGT Security Services — Authentication Routes
 * File: firebase/functions/src/routes/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ENDPOINTS:
 *   POST /api/auth/login                   — stub (frontend uses Firebase SDK directly)
 *   POST /api/auth/forgot-password         — send OTP to reset password
 *   POST /api/auth/reset-password          — verify OTP + set new password
 *   POST /api/auth/resend-reset-otp        — resend password reset OTP
 *   POST /api/auth/employee/register       — new guard self-registration
 *   POST /api/auth/employee/verify-otp     — verify phone OTP after registration
 *   POST /api/auth/employee/resend-otp     — resend registration OTP
 *   POST /api/auth/guard/keycode-login     — keycode-based login (no password)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRATION FLOW (new guard joining VAGT):
 *
 *   Step 1 — Guard opens register page, enters phone + email + password
 *            → POST /api/auth/employee/register
 *            → OTP generated (6 digits, 15 min TTL) stored in pending_registrations
 *            → OTP sent via 2Factor.in SMS
 *            → Returns: { registration_token: "reg_..." }
 *
 *   Step 2 — Guard enters OTP from SMS
 *            → POST /api/auth/employee/verify-otp
 *            → Firebase Auth account created (DISABLED — can't log in yet)
 *            → pending_registrations doc marked verified
 *            → Admin sees new pending registration in admin portal
 *
 *   Step 3 — Admin approves in admin portal
 *            → POST /api/admin/registrations/:id/approve  (see admin.js)
 *            → Firebase Auth account ENABLED
 *            → Employee Firestore doc created with VAGT-XXXX ID
 *            → Firebase password reset email sent automatically (free, no SMS needed)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PASSWORD RESET FLOW:
 *
 *   Guard enters employee ID or email
 *     → OTP generated, stored in password_reset_tokens
 *     → OTP sent via 2Factor.in SMS
 *   Guard enters OTP + new password
 *     → OTP verified, password updated in Firebase Auth
 *     → Reset token marked used (can't reuse)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KEYCODE LOGIN FLOW (for guards without smartphones):
 *
 *   Guard types their physical keycode (format: XXXX-XXXX) on any shared device
 *     → Keycode looked up in guard_keycodes collection
 *     → If active: GPS + device info logged to sign_in_events
 *     → Returns a Firebase Custom Token the frontend exchanges for a session
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SMS PROVIDER: 2Factor.in
 *
 *   Set up (one-time):
 *     1. Sign up at https://2factor.in — free, instant
 *     2. Copy your API key from the 2Factor dashboard
 *     3. Set Firebase Functions config:
 *          firebase functions:config:set twofactor.key="YOUR_2FACTOR_API_KEY"
 *     4. Deploy functions:
 *          firebase deploy --only functions --project vagt---services
 *
 *   How it works:
 *     - 2Factor.in uses their own DLT-registered entity — no DLT setup needed from you
 *     - OTP SMS arrives from a short code (e.g. VM-VAGTSV) within seconds
 *     - Free tier: plenty for testing; paid plans start at ₹0.25/SMS
 *
 *   If SMS fails (non-fatal):
 *     - Registration still succeeds — OTP is in Firestore
 *     - Check: Firestore Console → pending_registrations → doc → 'otp' field
 *     - To test without SMS: read the OTP from Firestore and enter it manually
 *
 * DEBUG TIPS:
 *   - "Invalid registration token" → the reg_... token expired or was already used
 *   - "Already verified" → guard tried to verify the same OTP twice (harmless)
 *   - "An account with this email already exists" → guard already registered;
 *     they should use forgot-password instead
 *   - OTP always wrong → check Firestore Console → pending_registrations → doc → 'otp'
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');

// Generates a cryptographically secure 6-digit OTP (000000–999999).
// Uses crypto.randomBytes instead of Math.random — Math.random is not
// suitable for security-sensitive values because it is predictable.
function secureOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

// ── SMS via 2Factor.in ────────────────────────────────────────────────────────
// Sends a 6-digit OTP to an Indian mobile number using 2Factor.in's OTP API.
// Non-fatal: if SMS delivery fails, the OTP is still in Firestore so you can
// test manually. Guard experience degrades gracefully rather than failing hard.
//
// API key is in process.env.TWOFACTOR_API_KEY (matches .env file pattern used throughout).
// Local: add TWOFACTOR_API_KEY=<key> to firebase/functions/.env
// Production: Firebase Console → Functions → api → Edit → Environment variables → Add
//
// 2Factor.in OTP API endpoint:
//   GET https://2factor.in/API/V1/{API_KEY}/SMS/{PHONE_NUMBER}/{OTP}
// On success: { "Status": "Success", "Details": "Session ID" }
// On failure: { "Status": "Error",   "Details": "reason" }
// ─────────────────────────────────────────────────────────────────────────────
async function sendOtp(phone, otp, context = '') {
  // API key from environment variable — set in .env for local, Firebase console for prod.
  // To set in production: Firebase Console → Functions → [your function] → Edit → Env vars
  // Or via CLI: firebase functions:config:set is legacy; use .env file approach instead.
  const apiKey = process.env.TWOFACTOR_API_KEY;

  if (!apiKey || apiKey === 'YOUR_2FACTOR_API_KEY') {
    console.warn(`[SMS] No 2Factor API key configured — OTP for ${phone} (${context}) not sent. Check Firestore to test.`);
    return { sent: false, reason: 'no_api_key' };
  }

  // Normalise phone: strip leading 0, +91, spaces, dashes. API expects 10-digit number.
  const cleaned = phone.replace(/[\s\-+]/g, '').replace(/^0?91/, '').replace(/^0/, '');
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    console.warn(`[SMS] Invalid Indian mobile: ${phone} — OTP not sent.`);
    return { sent: false, reason: 'invalid_phone' };
  }

  const url = `https://2factor.in/API/V1/${apiKey}/SMS/${cleaned}/${otp}/AUTOGEN`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.Status === 'Success') {
      console.log(`[SMS] OTP sent to ${cleaned} (${context}) — session: ${data.Details}`);
      return { sent: true, session: data.Details };
    } else {
      console.warn(`[SMS] 2Factor error for ${cleaned}: ${data.Details}`);
      return { sent: false, reason: data.Details };
    }
  } catch (err) {
    console.warn(`[SMS] fetch failed for ${cleaned}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

// Generates a secure random token string (e.g. for reset_token, reg_token).
// 24 hex chars = 96 bits of entropy — effectively unguessable.
function secureToken(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

module.exports = function ({ db, auth, authLimiter, loginLimiter }) {
  const router = express.Router();

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  // NOTE: Actual login is handled by the Firebase client SDK on the frontend
  // (firebase.auth().signInWithEmailAndPassword). This backend endpoint exists
  // only as a placeholder for future server-side session cookie support.
  router.post('/login', loginLimiter, async (req, res) => {
    return res.status(501).json({ message: 'Use Firebase client SDK for authentication.' });
  });

  // ── POST /api/auth/forgot-password ────────────────────────────────────────
  // Guard enters their employee ID (e.g. VAGT-0001) or email to start reset.
  // Returns a reset_token that is needed in the next step.
  router.post('/forgot-password', authLimiter, async (req, res) => {
    const { identifier, device_trust_token } = req.body || {};
    if (!identifier) return res.status(400).json({ message: 'identifier is required.' });

    try {
      // Try to find the user by email first, then fall back to employee_id
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(identifier);
      } catch {
        // Not an email — try looking up by employee_id in Firestore
        const snap = await db.collection('employees')
          .where('employee_id', '==', identifier)
          .limit(1)
          .get();
        if (snap.empty) return res.status(404).json({ message: 'No account found for that identifier.' });
        userRecord = await auth.getUser(snap.docs[0].id);
      }

      // ── Device trust check — skip SMS if this device was verified before ──
      // The guard's browser sends their stored device_trust_token with this request.
      // If it's valid and matches this user, we skip the OTP SMS entirely and return
      // a reset token directly. This is the primary cost-saving mechanism.
      if (device_trust_token) {
        try {
          const trustSnap = await db.collection('device_trust_tokens').doc(device_trust_token).get();
          if (trustSnap.exists) {
            const trust = trustSnap.data();
            const notExpired = trust.expires_at && new Date() < trust.expires_at.toDate();
            const matchesUser = trust.uid === userRecord.uid;
            if (notExpired && matchesUser) {
              // Device recognised — issue reset token with no OTP required
              const resetToken = secureToken('rst');
              await db.collection('password_reset_tokens').doc(resetToken).set({
                uid:                userRecord.uid,
                otp:                null,       // no OTP needed — device was trusted
                trusted_device:     true,
                expires_at:         new Date(Date.now() + 15 * 60 * 1000),
                used:               false,
                created_at:         new Date(),
                otp_sent_at:        null,
                otp_send_count:     0,
              });
              // Update device last_used_at
              await trustSnap.ref.update({ last_used_at: new Date() });
              console.log(`[DeviceTrust] Trusted device for uid ${userRecord.uid} — skipping OTP`);
              return res.json({ reset_token: resetToken, trusted_device: true, message: 'Device recognised. No OTP required.' });
            }
          }
        } catch (trustErr) {
          console.warn('[DeviceTrust] Token check failed (non-fatal):', trustErr.message);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Generate a 6-digit OTP and a unique token to tie the OTP to this reset attempt.
      // The token (not the OTP) is what gets passed between steps — the OTP is the secret.
      const otp        = secureOtp();
      const resetToken = secureToken('rst');
      const expiresAt  = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      const now        = new Date();

      await db.collection('password_reset_tokens').doc(resetToken).set({
        uid:            userRecord.uid,
        otp,
        expires_at:     expiresAt,
        used:           false,
        created_at:     now,
        otp_sent_at:    now,
        otp_send_count: 1,
      });

      // Look up phone from Firestore employee record (Firebase Auth may not have phoneNumber set)
      let phone = userRecord.phoneNumber || null;
      if (!phone) {
        try {
          const empSnap = await db.collection('employees').doc(userRecord.uid).get();
          if (empSnap.exists) phone = empSnap.data().phone || null;
        } catch { /* non-fatal */ }
      }

      if (phone) {
        await sendOtp(phone, otp, 'password-reset');
      } else {
        console.warn(`[SMS] No phone on file for uid ${userRecord.uid} — OTP not sent via SMS.`);
      }

      // We return the reset_token to the frontend so it can pass it to the next step.
      // The OTP itself is NOT returned — it should only arrive via SMS.
      return res.json({ reset_token: resetToken, message: 'OTP sent to registered phone/email.' });
    } catch (err) {
      console.error('forgot-password error:', err);
      return res.status(500).json({ message: 'Failed to process request.' });
    }
  });

  // ── POST /api/auth/reset-password ─────────────────────────────────────────
  // Guard submits: the reset_token from the previous step + the OTP they received
  // via SMS + their new password.
  router.post('/reset-password', authLimiter, async (req, res) => {
    const { reset_token, otp, new_password } = req.body || {};
    if (!reset_token || !new_password) {
      return res.status(400).json({ message: 'reset_token and new_password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
      const docRef = db.collection('password_reset_tokens').doc(reset_token);
      const snap   = await docRef.get();

      if (!snap.exists)     return res.status(400).json({ message: 'Invalid reset token.' });
      if (snap.data().used) return res.status(400).json({ message: 'This reset link has already been used.' });
      if (new Date() > snap.data().expires_at.toDate()) {
        return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
      }

      const d = snap.data();
      // If trusted_device=true, OTP was skipped — don't require it.
      // Otherwise validate the OTP that was sent via SMS.
      if (!d.trusted_device) {
        if (!otp) return res.status(400).json({ message: 'otp is required.' });
        if (d.otp !== otp) return res.status(400).json({ message: 'Incorrect OTP.' });
      }

      // All checks passed — update the password in Firebase Auth
      await auth.updateUser(d.uid, { password: new_password });

      // Mark token as used so it can't be replayed
      await docRef.update({ used: true });

      // Issue (or refresh) a device trust token so this device skips OTP next time
      const deviceToken = secureToken('dev');
      await db.collection('device_trust_tokens').doc(deviceToken).set({
        uid:        d.uid,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      return res.json({ success: true, device_trust_token: deviceToken });
    } catch (err) {
      console.error('reset-password error:', err);
      return res.status(500).json({ message: 'Failed to reset password.' });
    }
  });

  // ── POST /api/auth/resend-reset-otp ───────────────────────────────────────
  // Guard didn't receive the SMS — generate a fresh OTP on the same reset_token.
  // The old OTP is replaced; the token stays the same.
  router.post('/resend-reset-otp', authLimiter, async (req, res) => {
    const { reset_token } = req.body || {};
    if (!reset_token) return res.status(400).json({ message: 'reset_token is required.' });

    try {
      const docRef = db.collection('password_reset_tokens').doc(reset_token);
      const snap   = await docRef.get();
      if (!snap.exists)      return res.status(400).json({ message: 'Invalid reset token.' });

      const d = snap.data();
      if (d.used)            return res.status(400).json({ message: 'Token already used.' });
      if (d.trusted_device)  return res.status(400).json({ message: 'No OTP needed for trusted device.' });

      // ── Rate limit: 60s cooldown, max 3 sends ────────────────────────────
      const OTP_COOLDOWN_S = 60;
      const OTP_MAX_SENDS  = 3;
      if (d.otp_sent_at) {
        const secsSince = (Date.now() - d.otp_sent_at.toDate().getTime()) / 1000;
        if (secsSince < OTP_COOLDOWN_S) {
          const waitSecs = Math.ceil(OTP_COOLDOWN_S - secsSince);
          return res.status(429).json({ message: `Please wait ${waitSecs} seconds before requesting another OTP.`, wait_seconds: waitSecs });
        }
      }
      if ((d.otp_send_count || 0) >= OTP_MAX_SENDS) {
        return res.status(429).json({ message: 'Maximum OTP attempts reached. Please start over.' });
      }
      // ─────────────────────────────────────────────────────────────────────

      const newOtp    = secureOtp();
      const newExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const now       = new Date();

      await docRef.update({
        otp:            newOtp,
        expires_at:     newExpiry,
        otp_sent_at:    now,
        otp_send_count: (d.otp_send_count || 1) + 1,
      });

      // Look up the employee's phone from Firestore to resend the OTP
      try {
        const empSnap = await db.collection('employees').doc(d.uid).get();
        const phone   = (empSnap.exists && empSnap.data().phone) || null;
        if (phone) await sendOtp(phone, newOtp, 'password-reset-resend');
        else console.warn(`[SMS] No phone on file for uid ${d.uid} — OTP resend skipped.`);
      } catch (smsErr) {
        console.warn('[SMS] Resend lookup failed (non-fatal):', smsErr.message);
      }

      return res.json({ message: 'OTP resent.' });
    } catch (err) {
      console.error('resend-reset-otp error:', err);
      return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
  });

  // ── POST /api/auth/employee/register ──────────────────────────────────────
  // Step 1 of new guard registration.
  // Stores the pending registration in Firestore and sends an OTP to phone.
  // IMPORTANT: The password entered here is validated for length but NOT stored.
  // The guard sets their real password later via a reset link sent on admin approval.
  router.post('/employee/register', authLimiter, async (req, res) => {
    const { phone, email, password, name } = req.body || {};
    if (!phone || !email || !password) {
      return res.status(400).json({ message: 'phone, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
      // Reject if this email already has an account (active or pending)
      try {
        await auth.getUserByEmail(email);
        return res.status(409).json({ message: 'An account with this email already exists.' });
      } catch {
        // Expected: email not found → proceed
      }

      const otp      = secureOtp();
      const regToken = secureToken('reg');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Store registration intent — NOT the password
      // otp_sent_at + otp_send_count are used to enforce resend rate limits.
      const now = new Date();
      await db.collection('pending_registrations').doc(regToken).set({
        phone,
        email,
        name:           (name || '').trim().slice(0, 100) || null,
        otp,
        expires_at:     expiresAt,
        verified:       false,
        created_at:     now,
        otp_sent_at:    now,
        otp_send_count: 1,
      });

      // Send OTP via 2Factor.in. Non-fatal — registration still succeeds if SMS fails.
      await sendOtp(phone, otp, 'registration');

      // Return the token (not the OTP) — frontend needs it for the verify step
      return res.json({ registration_token: regToken });
    } catch (err) {
      console.error('employee/register error:', err);
      return res.status(500).json({ message: 'Registration failed.' });
    }
  });

  // ── POST /api/auth/employee/verify-otp ────────────────────────────────────
  // Step 2 of registration — guard enters the OTP from their SMS.
  // If correct, a DISABLED Firebase Auth account is created.
  // The account stays disabled until an admin approves it in the admin portal.
  router.post('/employee/verify-otp', authLimiter, async (req, res) => {
    const { registration_token, otp } = req.body || {};
    if (!registration_token || !otp) {
      return res.status(400).json({ message: 'registration_token and otp are required.' });
    }

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap   = await docRef.get();
      if (!snap.exists)        return res.status(400).json({ message: 'Invalid registration token.' });

      const data = snap.data();
      if (data.verified)       return res.status(400).json({ message: 'Already verified.' });
      if (new Date() > data.expires_at.toDate()) {
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }
      if (data.otp !== otp)    return res.status(400).json({ message: 'Incorrect OTP.' });

      // Create the Firebase Auth account in a DISABLED state.
      // We use a random temp password — the real password is set later via reset link.
      // IMPORTANT: do not log or store this tempPassword anywhere.
      const tempPassword = crypto.randomBytes(24).toString('base64url');
      const userRecord   = await auth.createUser({
        email:       data.email,
        password:    tempPassword,
        displayName: data.name || data.phone,
        disabled:    true, // ← stays disabled until admin approves
      });

      await docRef.update({
        verified:     true,
        verified_at:  new Date(),
        firebase_uid: userRecord.uid, // needed by admin/approve endpoint
      });

      // Let the admin know there's a new registration waiting for review
      await db.collection('activity_log').add({
        type:        'registration',
        description: `New employee registration request from ${data.phone}`,
        time:        new Date(),
        actor:       data.phone,
      });

      // Issue a device trust token — stored in the guard's browser and sent with
      // future password reset requests so they can skip the SMS OTP from this device.
      const deviceToken = secureToken('dev');
      await db.collection('device_trust_tokens').doc(deviceToken).set({
        phone:      data.phone,
        uid:        userRecord.uid,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      });

      return res.json({ success: true, device_trust_token: deviceToken });
    } catch (err) {
      console.error('employee/verify-otp error:', err);
      return res.status(500).json({ message: 'Verification failed.' });
    }
  });

  // ── POST /api/auth/employee/resend-otp ────────────────────────────────────
  // Guard didn't receive SMS during registration — regenerate and resend.
  router.post('/employee/resend-otp', authLimiter, async (req, res) => {
    const { registration_token } = req.body || {};
    if (!registration_token) return res.status(400).json({ message: 'registration_token is required.' });

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap   = await docRef.get();
      if (!snap.exists)          return res.status(400).json({ message: 'Invalid registration token.' });
      if (snap.data().verified)  return res.status(400).json({ message: 'Already verified.' });

      const d = snap.data();

      // ── Rate limit: 60s cooldown between resends ─────────────────────────
      const OTP_COOLDOWN_S = 60;
      const OTP_MAX_SENDS  = 3;
      if (d.otp_sent_at) {
        const secsSince = (Date.now() - d.otp_sent_at.toDate().getTime()) / 1000;
        if (secsSince < OTP_COOLDOWN_S) {
          const waitSecs = Math.ceil(OTP_COOLDOWN_S - secsSince);
          return res.status(429).json({ message: `Please wait ${waitSecs} seconds before requesting another OTP.`, wait_seconds: waitSecs });
        }
      }
      if ((d.otp_send_count || 0) >= OTP_MAX_SENDS) {
        return res.status(429).json({ message: 'Maximum OTP attempts reached. Please start a new registration.' });
      }
      // ─────────────────────────────────────────────────────────────────────

      const newOtp    = secureOtp();
      const newExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const now       = new Date();

      await docRef.update({
        otp:            newOtp,
        expires_at:     newExpiry,
        otp_sent_at:    now,
        otp_send_count: (d.otp_send_count || 1) + 1,
      });

      // Resend OTP to the same phone stored in the pending registration
      if (d.phone) await sendOtp(d.phone, newOtp, 'registration-resend');

      return res.json({ message: 'OTP resent.' });
    } catch (err) {
      console.error('employee/resend-otp error:', err);
      return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
  });

  // ── POST /api/auth/guard/keycode-login ────────────────────────────────────
  // Alternative login for guards who use a physical keycode card instead of
  // a username/password. The keycode is in format XXXX-XXXX (no ambiguous chars).
  //
  // WHY THIS EXISTS: Some guards don't have smartphones or struggle with passwords.
  // The keycode is printed on a physical card. They type it on any shared tablet.
  //
  // WHAT HAPPENS:
  //   1. Keycode looked up in guard_keycodes collection
  //   2. GPS + device info logged to sign_in_events (audit trail)
  //   3. A Firebase Custom Token is returned — frontend exchanges it for a session
  //
  // DEBUG TIP: If a guard says "keycode not working":
  //   1. Check guard_keycodes in Firestore — is the keycode there with active: true?
  //   2. Check sign_in_events — is the attempt being logged at all?
  //   3. If not logged, the keycode format might be wrong (spaces, lowercase, etc.)
  //      The code normalises to uppercase and strips non-alphanumeric, so XXXX-XXXX
  //      and xxxx-xxxx should both work.
  router.post('/guard/keycode-login', loginLimiter, async (req, res) => {
    const { keycode, latitude, longitude, accuracy, device_info } = req.body || {};
    if (!keycode || typeof keycode !== 'string') {
      return res.status(400).json({ message: 'keycode is required.' });
    }

    // Normalise: uppercase, strip everything except A-Z, 0-9, and dash
    // This makes the input forgiving — typos like spaces or lowercase are handled
    const normalised = keycode.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    try {
      const codeSnap = await db.collection('guard_keycodes').doc(normalised).get();

      if (!codeSnap.exists) {
        return res.status(401).json({ message: 'Invalid keycode.' });
      }

      const codeData = codeSnap.data();

      if (!codeData.active) {
        // Keycode was revoked — guard should contact their manager
        return res.status(403).json({ message: 'This keycode has been deactivated. Contact your manager.' });
      }

      const employeeUid = codeData.employee_uid;

      // Log the sign-in event with all available location/device data
      // This creates the audit trail for: who signed in, when, where, from what device
      const eventData = {
        employee_uid:  employeeUid,
        employee_id:   codeData.employee_id  || null,
        name:          codeData.name         || null,
        keycode:       normalised,
        latitude:      typeof latitude  === 'number' ? latitude  : null,
        longitude:     typeof longitude === 'number' ? longitude : null,
        geo_accuracy:  typeof accuracy  === 'number' ? accuracy  : null,  // metres
        device_info:   typeof device_info === 'string' ? device_info.slice(0, 512) : null, // capped at 512 chars
        ip_address:    req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
        timestamp:     new Date(),
      };
      await db.collection('sign_in_events').add(eventData);

      // Update last_used_at so admins can see when each keycode was last active
      await codeSnap.ref.update({ last_used_at: new Date() });

      // Mint a short-lived Firebase Custom Token for this employee
      // The frontend calls firebase.auth().signInWithCustomToken(customToken)
      // to get a full session. Custom tokens expire after 1 hour.
      const customToken = await auth.createCustomToken(employeeUid, { role: 'employee' });

      return res.json({
        custom_token: customToken,
        employee_id:  codeData.employee_id || null,
        name:         codeData.name        || null,
      });
    } catch (err) {
      console.error('guard/keycode-login error:', err);
      return res.status(500).json({ message: 'Sign-in failed. Please try again.' });
    }
  });

  // ── POST /api/auth/client/register ────────────────────────────────────────
  // Step 1 of client self-registration.
  // Client fills in name, phone, email, password, society name, unit number.
  // Same OTP flow as employee registration — admin approves before access is granted.
  router.post('/client/register', authLimiter, async (req, res) => {
    const { phone, email, password, name, society_name, unit_number } = req.body || {};
    if (!phone || !email || !password || !name || !society_name) {
      return res.status(400).json({ message: 'name, phone, email, password, and society_name are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
      // Reject if email already has an account
      try {
        await auth.getUserByEmail(email);
        return res.status(409).json({ message: 'An account with this email already exists.' });
      } catch {
        // Expected — proceed
      }

      const otp      = secureOtp();
      const regToken = secureToken('reg');
      const now      = new Date();

      await db.collection('pending_registrations').doc(regToken).set({
        role:           'client',
        phone,
        email,
        name:           name.trim().slice(0, 100),
        society_name:   society_name.trim().slice(0, 200),
        unit_number:    (unit_number || '').trim().slice(0, 50) || null,
        otp,
        expires_at:     new Date(Date.now() + 15 * 60 * 1000),
        verified:       false,
        created_at:     now,
        otp_sent_at:    now,
        otp_send_count: 1,
      });

      await sendOtp(phone, otp, 'client-registration');

      return res.json({ registration_token: regToken });
    } catch (err) {
      console.error('client/register error:', err);
      return res.status(500).json({ message: 'Registration failed.' });
    }
  });

  // ── POST /api/auth/client/verify-otp ──────────────────────────────────────
  // Step 2 — client enters OTP from SMS.
  // Creates a DISABLED Firebase Auth account. Admin approves → account enabled.
  router.post('/client/verify-otp', authLimiter, async (req, res) => {
    const { registration_token, otp } = req.body || {};
    if (!registration_token || !otp) {
      return res.status(400).json({ message: 'registration_token and otp are required.' });
    }

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap   = await docRef.get();
      if (!snap.exists)      return res.status(400).json({ message: 'Invalid registration token.' });

      const data = snap.data();
      if (data.verified)     return res.status(400).json({ message: 'Already verified.' });
      if (data.role !== 'client') return res.status(400).json({ message: 'Wrong registration type.' });
      if (new Date() > data.expires_at.toDate()) {
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }
      if (data.otp !== otp)  return res.status(400).json({ message: 'Incorrect OTP.' });

      const tempPassword = crypto.randomBytes(24).toString('base64url');
      const userRecord   = await auth.createUser({
        email:       data.email,
        password:    tempPassword,
        displayName: data.name,
        disabled:    true,
      });

      await docRef.update({
        verified:     true,
        verified_at:  new Date(),
        firebase_uid: userRecord.uid,
      });

      await db.collection('activity_log').add({
        type:        'registration',
        description: `New client registration request from ${data.name} (${data.society_name})`,
        time:        new Date(),
        actor:       data.phone,
      });

      const deviceToken = secureToken('dev');
      await db.collection('device_trust_tokens').doc(deviceToken).set({
        phone:      data.phone,
        uid:        userRecord.uid,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      return res.json({ success: true, device_trust_token: deviceToken });
    } catch (err) {
      console.error('client/verify-otp error:', err);
      return res.status(500).json({ message: 'Verification failed.' });
    }
  });

  // ── POST /api/auth/client/resend-otp ──────────────────────────────────────
  router.post('/client/resend-otp', authLimiter, async (req, res) => {
    const { registration_token } = req.body || {};
    if (!registration_token) return res.status(400).json({ message: 'registration_token is required.' });

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap   = await docRef.get();
      if (!snap.exists)         return res.status(400).json({ message: 'Invalid registration token.' });
      if (snap.data().verified) return res.status(400).json({ message: 'Already verified.' });

      const d = snap.data();
      const OTP_COOLDOWN_S = 60;
      const OTP_MAX_SENDS  = 3;
      if (d.otp_sent_at) {
        const secsSince = (Date.now() - d.otp_sent_at.toDate().getTime()) / 1000;
        if (secsSince < OTP_COOLDOWN_S) {
          const waitSecs = Math.ceil(OTP_COOLDOWN_S - secsSince);
          return res.status(429).json({ message: `Please wait ${waitSecs} seconds before requesting another OTP.`, wait_seconds: waitSecs });
        }
      }
      if ((d.otp_send_count || 0) >= OTP_MAX_SENDS) {
        return res.status(429).json({ message: 'Maximum OTP attempts reached. Please start a new registration.' });
      }

      const newOtp = secureOtp();
      const now    = new Date();
      await docRef.update({
        otp:            newOtp,
        expires_at:     new Date(Date.now() + 15 * 60 * 1000),
        otp_sent_at:    now,
        otp_send_count: (d.otp_send_count || 1) + 1,
      });

      if (d.phone) await sendOtp(d.phone, newOtp, 'client-registration-resend');

      return res.json({ message: 'OTP resent.' });
    } catch (err) {
      console.error('client/resend-otp error:', err);
      return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
  });

  return { router };
};
