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
// Only allow requests from our own domain (and localhost when developing).
// If you get "CORS error" in the browser, check that the request is coming from
// one of these origins.  DO NOT add '*' — that would allow any website to call
// our backend.
const allowedOrigins = [
  'https://vagtsecurityservices.com',
  'https://www.vagtsecurityservices.com',
];
if (process.env.NODE_ENV !== 'production') {
  // Allow local dev server — remove this block before going to production
  allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');
}
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
