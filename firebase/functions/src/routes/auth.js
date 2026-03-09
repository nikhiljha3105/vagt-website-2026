/**
 * Auth routes
 *
 * POST /api/auth/login
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 * POST /api/auth/resend-reset-otp
 * POST /api/auth/employee/register
 * POST /api/auth/employee/verify-otp
 * POST /api/auth/employee/resend-otp
 * POST /api/auth/guard/keycode-login
 */

'use strict';

const express = require('express');

module.exports = function ({ db, auth, authLimiter, loginLimiter }) {
  const router = express.Router();

  // ── POST /api/auth/login ─────────────────────────────────────────────────
  // Frontend uses Firebase client SDK directly for login; this endpoint is
  // here for completeness and for future server-side session cookie support.
  // The current client-side flow: firebase.auth().signInWithEmailAndPassword()
  router.post('/login', loginLimiter, async (req, res) => {
    // Firebase client SDK handles auth directly.
    // This endpoint can be used for admin SDK session-cookie minting.
    return res.status(501).json({ message: 'Use Firebase client SDK for authentication.' });
  });

  // ── POST /api/auth/forgot-password ───────────────────────────────────────
  router.post('/forgot-password', authLimiter, async (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ message: 'identifier is required.' });

    try {
      // Look up employee by employee_id or email
      let userRecord;
      try {
        // Try as email first
        userRecord = await auth.getUserByEmail(identifier);
      } catch {
        // Fall back to looking up by employee_id custom attribute via Firestore
        const snap = await db.collection('employees')
          .where('employee_id', '==', identifier)
          .limit(1)
          .get();
        if (snap.empty) return res.status(404).json({ message: 'No account found for that identifier.' });
        const uid = snap.docs[0].id;
        userRecord = await auth.getUser(uid);
      }

      // Generate and store a 6-digit OTP in Firestore (TTL: 15 min)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const resetToken = `rst_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.collection('password_reset_tokens').doc(resetToken).set({
        uid: userRecord.uid,
        otp,
        expires_at: expiresAt,
        used: false,
        created_at: new Date(),
      });

      // TODO: Send OTP via SMS / email (integrate Twilio / SendGrid here)
      console.info(`[forgot-password] OTP for ${userRecord.uid}: ${otp} (token: ${resetToken})`);

      return res.json({ reset_token: resetToken, message: 'OTP sent to registered phone/email.' });
    } catch (err) {
      console.error('forgot-password error:', err);
      return res.status(500).json({ message: 'Failed to process request.' });
    }
  });

  // ── POST /api/auth/reset-password ────────────────────────────────────────
  router.post('/reset-password', authLimiter, async (req, res) => {
    const { reset_token, otp, new_password } = req.body || {};
    if (!reset_token || !otp || !new_password) {
      return res.status(400).json({ message: 'reset_token, otp, and new_password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
      const docRef = db.collection('password_reset_tokens').doc(reset_token);
      const snap = await docRef.get();

      if (!snap.exists) return res.status(400).json({ message: 'Invalid reset token.' });

      const data = snap.data();
      if (data.used) return res.status(400).json({ message: 'This reset link has already been used.' });
      if (new Date() > data.expires_at.toDate()) {
        return res.status(400).json({ message: 'Reset token has expired. Please request a new one.' });
      }
      if (data.otp !== otp) return res.status(400).json({ message: 'Incorrect OTP.' });

      await auth.updateUser(data.uid, { password: new_password });
      await docRef.update({ used: true });

      return res.json({ success: true });
    } catch (err) {
      console.error('reset-password error:', err);
      return res.status(500).json({ message: 'Failed to reset password.' });
    }
  });

  // ── POST /api/auth/resend-reset-otp ──────────────────────────────────────
  router.post('/resend-reset-otp', authLimiter, async (req, res) => {
    const { reset_token } = req.body || {};
    if (!reset_token) return res.status(400).json({ message: 'reset_token is required.' });

    try {
      const docRef = db.collection('password_reset_tokens').doc(reset_token);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(400).json({ message: 'Invalid reset token.' });

      const data = snap.data();
      if (data.used) return res.status(400).json({ message: 'Token already used.' });

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiry = new Date(Date.now() + 15 * 60 * 1000);

      await docRef.update({ otp: newOtp, expires_at: newExpiry });

      // TODO: Resend OTP via SMS / email
      console.info(`[resend-otp] New OTP for token ${reset_token}: ${newOtp}`);

      return res.json({ message: 'OTP resent.' });
    } catch (err) {
      console.error('resend-reset-otp error:', err);
      return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
  });

  // ── POST /api/auth/employee/register ─────────────────────────────────────
  router.post('/employee/register', authLimiter, async (req, res) => {
    const { phone, email, password } = req.body || {};
    if (!phone || !email || !password) {
      return res.status(400).json({ message: 'phone, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    try {
      // Check if email already exists
      try {
        await auth.getUserByEmail(email);
        return res.status(409).json({ message: 'An account with this email already exists.' });
      } catch {
        // Expected: user not found
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const regToken = `reg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.collection('pending_registrations').doc(regToken).set({
        phone,
        email,
        password_hash: password,   // TODO: hash before storing; for now stored temporarily
        otp,
        expires_at: expiresAt,
        verified: false,
        created_at: new Date(),
      });

      // TODO: Send OTP to phone
      console.info(`[employee/register] OTP for ${phone}: ${otp}`);

      return res.json({ registration_token: regToken });
    } catch (err) {
      console.error('employee/register error:', err);
      return res.status(500).json({ message: 'Registration failed.' });
    }
  });

  // ── POST /api/auth/employee/verify-otp ───────────────────────────────────
  router.post('/employee/verify-otp', authLimiter, async (req, res) => {
    const { registration_token, otp } = req.body || {};
    if (!registration_token || !otp) {
      return res.status(400).json({ message: 'registration_token and otp are required.' });
    }

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(400).json({ message: 'Invalid registration token.' });

      const data = snap.data();
      if (data.verified) return res.status(400).json({ message: 'Already verified.' });
      if (new Date() > data.expires_at.toDate()) {
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }
      if (data.otp !== otp) return res.status(400).json({ message: 'Incorrect OTP.' });

      await docRef.update({ verified: true, verified_at: new Date() });

      // Notify admin of new pending registration
      await db.collection('activity_log').add({
        type: 'registration',
        description: `New employee registration request from ${data.phone}`,
        time: new Date(),
        actor: data.phone,
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('employee/verify-otp error:', err);
      return res.status(500).json({ message: 'Verification failed.' });
    }
  });

  // ── POST /api/auth/employee/resend-otp ───────────────────────────────────
  router.post('/employee/resend-otp', authLimiter, async (req, res) => {
    const { registration_token } = req.body || {};
    if (!registration_token) return res.status(400).json({ message: 'registration_token is required.' });

    try {
      const docRef = db.collection('pending_registrations').doc(registration_token);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(400).json({ message: 'Invalid registration token.' });

      const data = snap.data();
      if (data.verified) return res.status(400).json({ message: 'Already verified.' });

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiry = new Date(Date.now() + 15 * 60 * 1000);

      await docRef.update({ otp: newOtp, expires_at: newExpiry });

      // TODO: Resend OTP to phone
      console.info(`[employee/resend-otp] New OTP for ${data.phone}: ${newOtp}`);

      return res.json({ message: 'OTP resent.' });
    } catch (err) {
      console.error('employee/resend-otp error:', err);
      return res.status(500).json({ message: 'Failed to resend OTP.' });
    }
  });

  // ── POST /api/auth/guard/keycode-login ───────────────────────────────────
  // Guard authenticates with a physical non-expiring keycode.
  // Captures GPS + device info at sign-in. Returns a Firebase Custom Token.
  router.post('/guard/keycode-login', loginLimiter, async (req, res) => {
    const { keycode, latitude, longitude, accuracy, device_info } = req.body || {};
    if (!keycode || typeof keycode !== 'string') {
      return res.status(400).json({ message: 'keycode is required.' });
    }

    // Normalise: uppercase, strip non-alphanumeric except dash
    const normalised = keycode.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    try {
      const codeSnap = await db.collection('guard_keycodes').doc(normalised).get();

      if (!codeSnap.exists) {
        return res.status(401).json({ message: 'Invalid keycode.' });
      }

      const codeData = codeSnap.data();

      if (!codeData.active) {
        return res.status(403).json({ message: 'This keycode has been deactivated. Contact your manager.' });
      }

      const employeeUid = codeData.employee_uid;

      // Log the sign-in event (GPS + device fingerprint)
      const eventData = {
        employee_uid:  employeeUid,
        employee_id:   codeData.employee_id  || null,
        name:          codeData.name         || null,
        keycode:       normalised,
        latitude:      typeof latitude  === 'number' ? latitude  : null,
        longitude:     typeof longitude === 'number' ? longitude : null,
        geo_accuracy:  typeof accuracy  === 'number' ? accuracy  : null,
        device_info:   typeof device_info === 'string' ? device_info.slice(0, 512) : null,
        ip_address:    req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
        timestamp:     new Date(),
      };
      await db.collection('sign_in_events').add(eventData);

      // Update last_seen on the keycode doc
      await codeSnap.ref.update({ last_used_at: new Date() });

      // Mint a Firebase Custom Token for the employee
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

  return { router };
};
