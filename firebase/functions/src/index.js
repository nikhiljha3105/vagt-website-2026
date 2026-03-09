/**
 * VAGT Security Services — Cloud Functions Backend
 *
 * Entry point. Mounts all route groups under a single Express app
 * exposed as a single Cloud Function: `api`.
 *
 * All routes are prefixed /api/... — matched via the firebase.json rewrite rule:
 *   { "source": "/api/**", "function": "api" }
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

// ── Initialise Admin SDK ─────────────────────────────────────────────────────
admin.initializeApp();
const db   = admin.firestore();
const auth = admin.auth();

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();

// CORS — only allow the production domain (and localhost for dev)
const allowedOrigins = [
  'https://vagtsecurityservices.com',
  'https://www.vagtsecurityservices.com',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');
}
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// ── Rate limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { message: 'Too many requests. Please wait before trying again.', retry_after_seconds: 60 },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many login attempts. Please wait before trying again.', retry_after_seconds: 60 },
});

// ── Auth middleware ──────────────────────────────────────────────────────────
/**
 * Verifies Firebase ID token and attaches decoded claims to req.user.
 * Returns 401 if the token is missing or invalid.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }
  const token = header.slice(7);
  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

/** Requires req.user.role === 'employee' */
function requireEmployee(req, res, next) {
  if (req.user && req.user.role === 'employee') return next();
  return res.status(403).json({ message: 'Access denied. Employee role required.' });
}

/** Requires req.user.role === 'client' */
function requireClient(req, res, next) {
  if (req.user && req.user.role === 'client') return next();
  return res.status(403).json({ message: 'Access denied. Client role required.' });
}

/** Requires req.user.role === 'admin' */
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Access denied. Admin role required.' });
}

// ── Mount route modules ──────────────────────────────────────────────────────
const { router: authRouter }     = require('./routes/auth')({ db, auth, authLimiter, loginLimiter });
const { router: employeeRouter } = require('./routes/employee')({ db, requireAuth, requireEmployee });
const { router: clientRouter }   = require('./routes/client')({ db, requireAuth, requireClient });
const { router: adminRouter }    = require('./routes/admin')({ db, auth, requireAuth, requireAdmin });

app.use('/api/auth',     authRouter);
app.use('/api',          employeeRouter);
app.use('/api',          clientRouter);
app.use('/api/admin',    adminRouter);

// ── 404 catch-all ────────────────────────────────────────────────────────────
app.use(function (req, res) {
  res.status(404).json({ message: 'Endpoint not found.' });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use(function (err, req, res, _next) {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'An internal server error occurred.' });
});

// ── Export as Cloud Function ─────────────────────────────────────────────────
exports.api = functions
  .region('asia-south1')          // Mumbai — closest to Bengaluru
  .https.onRequest(app);
