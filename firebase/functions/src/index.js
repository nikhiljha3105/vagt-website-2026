/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VAGT Security Services — Cloud Functions Backend
 * File: firebase/functions/src/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW THIS WORKS (read this first):
 *
 *   The entire backend is ONE Cloud Function called "api" that runs Express.
 *   Every HTTP call to /api/... goes through this file first, then gets routed
 *   to the correct handler in one of the four route files below.
 *
 *   Request flow:
 *     Browser/App  →  Firebase Hosting  →  Cloud Function "api"  →  Express
 *       →  CORS check  →  Rate limiter  →  Auth check  →  Route handler
 *       →  Firestore / Firebase Auth  →  Response
 *
 *   Route files and what they own:
 *     auth.js      — registration, OTP, login, keycode sign-in
 *     employee.js  — attendance, leave, payslips, schedule, incidents
 *     client.js    — complaints, invoices, daily reports
 *     admin.js     — employees, payroll, clients, sites, schedule management
 *
 * HOW TO ADD A NEW ROUTE:
 *   1. Decide which file it belongs to (or create a new file if it's a new area)
 *   2. Add the route in that file following the same pattern
 *   3. Add the endpoint to the comment block at the top of that file
 *   No changes needed here unless you're adding a completely new route group.
 *
 * DEPLOYING:
 *   cd firebase/functions
 *   npm install
 *   firebase deploy --only functions
 *
 * VIEWING LOGS (when something breaks):
 *   firebase functions:log
 *   OR: Google Cloud Console → Logging → search for "api"
 *
 * TESTING LOCALLY:
 *   firebase emulators:start --only functions
 *   Then hit http://localhost:5001/<project-id>/asia-south1/api/...
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

// ── Firebase Admin SDK ────────────────────────────────────────────────────────
// admin.initializeApp() reads credentials automatically from the Cloud Function
// environment — no key file needed in production.
// If running locally, set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
admin.initializeApp();
const db   = admin.firestore();   // Firestore database handle
const auth = admin.auth();        // Firebase Authentication handle

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Only allow requests from our own domains.
// If you get "CORS error" in the browser, the request origin is not in this list.
// DO NOT add '*' — that would allow any website to call our backend.
const allowedOrigins = [
  'https://vagtservices.com',
  'https://www.vagtservices.com',
  'https://vagtsecurityservices.com',
  'https://www.vagtsecurityservices.com',
  'https://vagt---services.web.app',  // Firebase Hosting default URL
  'https://vagt---services.firebaseapp.com',
  'http://localhost:5000',           // local firebase serve
  'http://127.0.0.1:5000',
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Cap request body at 1 MB — prevents memory exhaustion from oversized payloads.
// No legitimate request in this app sends more than a few KB.
app.use(express.json({ limit: '1mb' }));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// These prevent brute-force and spam attacks.
// authLimiter:    10 requests per 15 minutes (OTP / forgot-password)
// loginLimiter:    5 requests per 15 minutes (login / keycode)
// actionLimiter:  60 requests per minute (check-in, guest entry, patrol scan)
//   — allows a guard to clock in once, log a few visitors, and scan patrol tags
//     without hitting the limit under normal use.
// INCREASE limits if legitimate users are getting blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests. Please wait before trying again.', retry_after_seconds: 60 },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many login attempts. Please wait before trying again.', retry_after_seconds: 60 },
});
const actionLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1-minute window
  max: 60,                      // 60 write actions per minute per IP
  message: { message: 'Too many requests. Please slow down.', retry_after_seconds: 30 },
});

// ── Auth middleware ────────────────────────────────────────────────────────────
// Every protected route calls one of these functions first.
//
// HOW IT WORKS:
//   The frontend calls firebase.auth().currentUser.getIdToken() to get a short-lived
//   JWT token, then passes it as: Authorization: Bearer <token>
//   We verify the token here using the Admin SDK — no database call needed,
//   Firebase validates the token cryptographically.
//   If valid, req.user will contain: { uid, role, email, ... }
//
// DEBUG TIP: If you get 401 errors, check:
//   1. Is the Authorization header being sent from the frontend?
//   2. Is the token expired? (They expire after 1 hour — frontend should refresh)
//   3. Is the Firebase project ID correct in firebase-config.js?

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }
  const token = header.slice(7); // Strip "Bearer " prefix
  try {
    req.user = await auth.verifyIdToken(token);
    next(); // Token is valid — proceed to the route handler
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// Role-check middleware — used AFTER requireAuth
// DEBUG TIP: If you get 403 errors, the user's role claim is wrong.
// Fix it by running: admin.auth().setCustomUserClaims(uid, { role: 'employee' })
// then have the user sign out and sign back in to refresh the token.

function requireEmployee(req, res, next) {
  if (req.user && req.user.role === 'employee') return next();
  return res.status(403).json({ message: 'Access denied. Employee role required.' });
}

function requireClient(req, res, next) {
  if (req.user && req.user.role === 'client') return next();
  return res.status(403).json({ message: 'Access denied. Client role required.' });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied. Admin role required.' });
}

// ── One-time first-admin setup endpoint ───────────────────────────────────────
// Solves the bootstrap problem: before ANY admin exists, there's no way to call
// an admin-protected endpoint.  This endpoint is protected by a passphrase
// instead of a Firebase token and self-disables once the claim is already set.
//
// USAGE (call once from curl after deploying):
//   POST https://vagtservices.com/api/setup/first-admin
//   Body: { "passphrase": "<value of SETUP_PASSPHRASE env var>" }
//
// Set the passphrase before deploying:
//   firebase functions:config:set setup.passphrase="your-secret-here"
// Then add to firebase/functions/.env: SETUP_PASSPHRASE=your-secret-here
//
// It is safe to leave this in — it does nothing if the claim is already set.
const SETUP_PASSPHRASE  = process.env.SETUP_PASSPHRASE || null;
const FIRST_ADMIN_EMAIL = process.env.FIRST_ADMIN_EMAIL || 'hello@vagtservices.com';

// Route registered at both paths: via Firebase Hosting the full /api/setup/... path
// is preserved; via direct Cloud Function URL only /setup/... is seen by Express.
app.post(['/api/setup/first-admin', '/setup/first-admin'], async (req, res) => {
  const { passphrase } = req.body || {};
  if (!SETUP_PASSPHRASE || passphrase !== SETUP_PASSPHRASE) {
    return res.status(403).json({ message: 'Wrong passphrase.' });
  }
  try {
    const user = await auth.getUserByEmail(FIRST_ADMIN_EMAIL);
    if (user.customClaims && user.customClaims.role === 'admin') {
      return res.json({ message: 'Admin claim already set. Nothing to do.', uid: user.uid });
    }
    await auth.setCustomUserClaims(user.uid, { role: 'admin' });
    await db.collection('admins').doc(user.uid).set({
      name:       user.displayName || 'Admin',
      email:      FIRST_ADMIN_EMAIL,
      created_at: new Date(),
      status:     'active',
    }, { merge: true });
    await db.collection('activity_log').add({
      action: 'first_admin_setup', uid: user.uid, email: FIRST_ADMIN_EMAIL,
      timestamp: new Date(), note: 'Admin claim set via setup endpoint',
    });
    return res.json({ message: '✅ Done. Sign out and back in to activate your admin session.', uid: user.uid });
  } catch (e) {
    console.error('first-admin setup error:', e);
    return res.status(500).json({ message: e.message });
  }
});

// ── Mount route modules ───────────────────────────────────────────────────────
// Each route file exports a factory function that receives shared dependencies
// (db, auth, middleware) and returns an Express router.
// This pattern makes each file independently testable.
const { router: authRouter }     = require('./routes/auth')({ db, auth, authLimiter, loginLimiter });
const { router: employeeRouter } = require('./routes/employee')({ db, requireAuth, requireEmployee, actionLimiter });
const { router: clientRouter }   = require('./routes/client')({ db, requireAuth, requireClient, actionLimiter });
const { router: adminRouter }    = require('./routes/admin')({ db, auth, requireAuth, requireAdmin });
const { router: guestRouter }    = require('./routes/guest')({ db, requireAuth, requireEmployee, requireAdmin, actionLimiter });
const { router: patrolRouter }   = require('./routes/patrol')({ db, requireAuth, requireEmployee, requireAdmin, actionLimiter });

app.use('/api/auth',     authRouter);     // POST /api/auth/login, /register, /verify-otp, etc.
app.use('/api',          employeeRouter); // GET/POST /api/attendance, /leave, /payslips, etc.
app.use('/api',          clientRouter);   // GET/POST /api/complaints, /client/invoices, etc.
app.use('/api/admin',    adminRouter);    // All /api/admin/... routes
app.use('/api/guest',    guestRouter);    // GET/POST /api/guest/entry, /exit/:token, /active
app.use('/api/patrol',   patrolRouter);   // GET/POST /api/patrol/checkpoint, /checkpoints, /today

// ── 404 catch-all ─────────────────────────────────────────────────────────────
// If a request reaches here, no route matched. Prevents Express from sending
// an ugly HTML 404 page.
app.use(function (req, res) {
  res.status(404).json({ message: 'Endpoint not found.' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// If any route handler throws an unhandled exception, it ends up here.
// The error is logged to Google Cloud Logging — check there first when debugging.
app.use(function (err, req, res, _next) {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'An internal server error occurred.' });
});

// ── Export as Cloud Function ──────────────────────────────────────────────────
// "asia-south1" is Mumbai — closest Google Cloud region to Bengaluru.
// Changing this region requires redeploying AND updating firebase.json rewrites.
exports.api = functions
  .region('asia-south1')
  .https.onRequest(app);

// ── Scheduled: daily Firestore backup to Cloud Storage ────────────────────────
// Runs at 02:00 IST (20:30 UTC) every day.
// Exports entire Firestore database to gs://vagt---services-backups/YYYY-MM-DD/
//
// ONE-TIME SETUP (run from Mac, once, before first deploy):
//
//   gcloud config set project vagt---services
//
//   # Create the backup bucket in Mumbai (same region as the Cloud Function)
//   gsutil mb -l asia-south1 gs://vagt---services-backups
//
//   # Auto-delete exports older than 30 days to control costs
//   echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lc.json
//   gsutil lifecycle set /tmp/lc.json gs://vagt---services-backups
//   rm /tmp/lc.json
//
//   # Grant the Cloud Functions service account export permissions
//   SA="vagt---services@appspot.gserviceaccount.com"
//   gcloud projects add-iam-policy-binding vagt---services \
//     --member="serviceAccount:$SA" --role="roles/datastore.importExportAdmin"
//   gcloud projects add-iam-policy-binding vagt---services \
//     --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
//
// To sync the GCS exports down to iCloud on your Mac:
//   bash scripts/sync-backups-to-icloud.sh
//
exports.scheduledFirestoreBackup = functions
  .region('asia-south1')
  .pubsub.schedule('30 20 * * *')    // 20:30 UTC = 02:00 IST
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const { v1 } = require('@google-cloud/firestore');
    const client    = new v1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT || 'vagt---services';
    const date      = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const outputUri = `gs://${projectId}-backups/${date}`;

    const [operation] = await client.exportDocuments({
      name:            client.databasePath(projectId, '(default)'),
      outputUriPrefix: outputUri,
    });

    console.info(`Firestore backup started → ${outputUri}  (operation: ${operation.name})`);
    return null;
  });

// ── Scheduled: flag missed check-outs from the previous day ──────────────────
// Runs at 06:00 IST (00:30 UTC) every morning.
// Finds any attendance log from yesterday (IST) that has a check_in but no
// check_out — meaning the guard forgot to tap out or their device died.
// Marks the doc with missed_checkout: true so admin can review and correct it.
// Does NOT write a fake check_out time — that would corrupt attendance records.
exports.flagMissedCheckouts = functions
  .region('asia-south1')
  .pubsub.schedule('30 0 * * *')   // 00:30 UTC = 06:00 IST
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const yesterday = new Date(Date.now() + IST_OFFSET_MS - 86400000);
    const dateStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD in IST

    const snap = await db.collection('attendance_logs')
      .where('date', '==', dateStr)
      .where('check_out', '==', null)
      .get();

    if (snap.empty) {
      console.info(`flagMissedCheckouts: no missed check-outs for ${dateStr}`);
      return null;
    }

    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { missed_checkout: true });
    });
    await batch.commit();
    console.info(`flagMissedCheckouts: flagged ${snap.size} record(s) for ${dateStr}`);
    return null;
  });

// ── Scheduled: expire guest log entries every hour ────────────────────────────
exports.expireGuestLogs = functions
  .region('asia-south1')
  .pubsub.schedule('every 60 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const now  = new Date();
    const snap = await db.collection('guest_logs')
      .where('status', '==', 'active')
      .where('expires_at', '<=', now)
      .limit(500)
      .get();

    if (snap.empty) return null;

    let batch  = db.batch();
    let count  = 0;
    const commits = [];
    for (const doc of snap.docs) {
      batch.update(doc.ref, { status: 'expired' });
      count++;
      if (count === 499) {
        commits.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) commits.push(batch.commit());
    await Promise.all(commits);
    return null;
  });
