/**
 * Guest entry / visitor management routes
 *
 * All routes require a valid Firebase ID token with role === 'employee'.
 *
 * POST /api/guest/entry           — log a new visitor, returns QR data URL
 * POST /api/guest/exit/:token     — mark a visitor as exited
 * GET  /api/guest/active          — list active visitors logged by this guard
 * GET  /api/guest/history         — visitor log for today (or ?date=YYYY-MM-DD)
 *
 * Scheduled function (exported from index.js):
 *   expireGuestLogs — runs every 60 min, marks expired active entries
 *
 * Firestore collection: guest_logs
 * Fields: token, visitor_name, visitor_type, purpose, visiting,
 *         site_id, site_name, guard_uid, guard_name,
 *         entry_time, exit_time, status, expires_at
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const QRCode  = require('qrcode');

module.exports = function ({ db, requireAuth, requireEmployee }) {
  const router = express.Router();
  const guard  = [requireAuth, requireEmployee];

  // ── POST /api/guest/entry ────────────────────────────────────────────────
  router.post('/entry', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { visitor_name, visitor_type, purpose, visiting, site_id } = req.body;

    if (!visitor_name || typeof visitor_name !== 'string' || !visitor_name.trim()) {
      return res.status(400).json({ message: 'visitor_name is required.' });
    }
    const VALID_TYPES = ['vendor', 'delivery', 'guest', 'tradesman'];
    if (!visitor_type || !VALID_TYPES.includes(visitor_type)) {
      return res.status(400).json({ message: `visitor_type must be one of: ${VALID_TYPES.join(', ')}.` });
    }
    if (!purpose || typeof purpose !== 'string' || !purpose.trim()) {
      return res.status(400).json({ message: 'purpose is required.' });
    }
    if (!visiting || typeof visiting !== 'string' || !visiting.trim()) {
      return res.status(400).json({ message: 'visiting (building/flat/dept) is required.' });
    }

    try {
      // Fetch guard details for denormalisation
      const empSnap = await db.collection('employees').doc(uid).get();
      const guardName = empSnap.exists ? (empSnap.data().name || uid) : uid;
      const siteName  = empSnap.exists ? (empSnap.data().site_name || null) : null;
      const resolvedSiteId = site_id || (empSnap.exists ? empSnap.data().site_id || null : null);

      const token     = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9C12B"
      const now       = new Date();
      const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);       // +8 hours

      const ref = await db.collection('guest_logs').add({
        token,
        visitor_name:  visitor_name.trim(),
        visitor_type,
        purpose:       purpose.trim(),
        visiting:      visiting.trim(),
        site_id:       resolvedSiteId,
        site_name:     siteName,
        guard_uid:     uid,
        guard_name:    guardName,
        entry_time:    now,
        exit_time:     null,
        status:        'active',
        expires_at:    expiresAt,
      });

      // Generate QR as PNG data URL — embeds only the token (8 chars)
      const qrDataUrl = await QRCode.toDataURL(token, {
        width: 260,
        margin: 2,
        color: { dark: '#0a1628', light: '#ffffff' },
      });

      return res.status(201).json({
        id:          ref.id,
        token,
        qr_data_url: qrDataUrl,
        entry_time:  now.toISOString(),
        expires_at:  expiresAt.toISOString(),
        visitor_name: visitor_name.trim(),
        visiting:    visiting.trim(),
        site_name:   siteName,
      });
    } catch (err) {
      console.error('guest/entry error:', err);
      return res.status(500).json({ message: 'Failed to log visitor entry.' });
    }
  });

  // ── POST /api/guest/exit/:token ──────────────────────────────────────────
  router.post('/exit/:token', ...guard, async (req, res) => {
    const { token } = req.params;
    if (!token || !/^[A-F0-9]{8}$/.test(token.toUpperCase())) {
      return res.status(400).json({ message: 'Invalid token format.' });
    }

    try {
      const snap = await db.collection('guest_logs')
        .where('token', '==', token.toUpperCase())
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (snap.empty) {
        return res.status(404).json({ message: 'No active guest entry found for this token.' });
      }

      const doc  = snap.docs[0];
      const now  = new Date();
      await doc.ref.update({ status: 'exited', exit_time: now });

      return res.json({ success: true, exit_time: now.toISOString() });
    } catch (err) {
      console.error('guest/exit error:', err);
      return res.status(500).json({ message: 'Failed to mark visitor exit.' });
    }
  });

  // ── GET /api/guest/active ────────────────────────────────────────────────
  router.get('/active', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('guest_logs')
        .where('guard_uid', '==', uid)
        .where('status', '==', 'active')
        .orderBy('entry_time', 'desc')
        .limit(100)
        .get();

      const items = snap.docs.map(doc => formatGuestLog(doc));
      return res.json(items);
    } catch (err) {
      console.error('guest/active error:', err);
      return res.status(500).json({ message: 'Failed to fetch active guests.' });
    }
  });

  // ── GET /api/guest/history ───────────────────────────────────────────────
  router.get('/history', ...guard, async (req, res) => {
    const uid  = req.user.uid;
    const date = req.query.date || todayStr();

    // Validate date param
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'date must be YYYY-MM-DD.' });
    }

    const dayStart = new Date(date + 'T00:00:00+05:30');
    const dayEnd   = new Date(date + 'T23:59:59+05:30');

    try {
      const snap = await db.collection('guest_logs')
        .where('guard_uid', '==', uid)
        .where('entry_time', '>=', dayStart)
        .where('entry_time', '<=', dayEnd)
        .orderBy('entry_time', 'desc')
        .limit(200)
        .get();

      const items = snap.docs.map(doc => formatGuestLog(doc));
      return res.json(items);
    } catch (err) {
      console.error('guest/history error:', err);
      return res.status(500).json({ message: 'Failed to fetch guest history.' });
    }
  });

  return { router };
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatGuestLog(doc) {
  const d = doc.data();
  return {
    id:           doc.id,
    token:        d.token,
    visitor_name: d.visitor_name,
    visitor_type: d.visitor_type,
    purpose:      d.purpose,
    visiting:     d.visiting,
    site_name:    d.site_name || null,
    guard_name:   d.guard_name || null,
    entry_time:   d.entry_time ? d.entry_time.toDate().toISOString() : null,
    exit_time:    d.exit_time  ? d.exit_time.toDate().toISOString()  : null,
    expires_at:   d.expires_at ? d.expires_at.toDate().toISOString() : null,
    status:       d.status,
  };
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
