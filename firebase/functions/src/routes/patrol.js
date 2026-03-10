/**
 * Beat patrol / guard tour routes
 *
 * Guards tap NFC tags at checkpoints; each tap fires POST /api/patrol/checkpoint.
 * Admin registers checkpoints per site; guards are auto-assigned based on their site.
 *
 * POST /api/patrol/checkpoint          — log an NFC checkpoint scan
 * GET  /api/patrol/checkpoints         — list checkpoints at guard's site
 * GET  /api/patrol/today               — guard's patrol log for today
 *
 * Admin routes (mounted under /api/admin/patrol/):
 * GET  /api/admin/patrol/checkpoints           — all checkpoints
 * POST /api/admin/patrol/checkpoints           — register a new checkpoint
 * DELETE /api/admin/patrol/checkpoints/:id     — remove a checkpoint
 * GET  /api/admin/patrol/logs                  — patrol logs (filterable by site/date/guard)
 *
 * Firestore collections:
 *   patrol_checkpoints  — { site_id, site_name, label, nfc_tag_id, active }
 *   patrol_logs         — { guard_uid, guard_name, checkpoint_id, checkpoint_label,
 *                           site_id, site_name, nfc_tag_id, scanned_at }
 */

'use strict';

const express = require('express');

module.exports = function ({ db, requireAuth, requireEmployee, requireAdmin }) {
  const router      = express.Router();
  const empGuard    = [requireAuth, requireEmployee];
  const adminGuard  = [requireAuth, requireAdmin];

  // ── POST /api/patrol/checkpoint ──────────────────────────────────────────
  // Called when a guard taps an NFC tag. The NFC tag ID is read by the phone
  // via the Web NFC API (navigator.nfc / NDEFReader) and sent here.
  router.post('/checkpoint', ...empGuard, async (req, res) => {
    const uid = req.user.uid;
    const { nfc_tag_id } = req.body;

    if (!nfc_tag_id || typeof nfc_tag_id !== 'string' || !nfc_tag_id.trim()) {
      return res.status(400).json({ message: 'nfc_tag_id is required.' });
    }

    try {
      // Look up the checkpoint by NFC tag ID
      const cpSnap = await db.collection('patrol_checkpoints')
        .where('nfc_tag_id', '==', nfc_tag_id.trim())
        .where('active', '==', true)
        .limit(1)
        .get();

      if (cpSnap.empty) {
        return res.status(404).json({ message: 'Checkpoint not found. Tag may not be registered.' });
      }

      const cp  = cpSnap.docs[0].data();
      const cpId = cpSnap.docs[0].id;

      // Get guard details for denormalisation
      const empSnap = await db.collection('employees').doc(uid).get();
      const guardName = empSnap.exists ? (empSnap.data().name || uid) : uid;

      const now = new Date();
      const ref = await db.collection('patrol_logs').add({
        guard_uid:          uid,
        guard_name:         guardName,
        checkpoint_id:      cpId,
        checkpoint_label:   cp.label,
        site_id:            cp.site_id || null,
        site_name:          cp.site_name || null,
        nfc_tag_id:         nfc_tag_id.trim(),
        scanned_at:         now,
      });

      return res.status(201).json({
        id:                ref.id,
        checkpoint_label:  cp.label,
        site_name:         cp.site_name || null,
        scanned_at:        now.toISOString(),
      });
    } catch (err) {
      console.error('patrol/checkpoint error:', err);
      return res.status(500).json({ message: 'Failed to log checkpoint.' });
    }
  });

  // ── GET /api/patrol/checkpoints ──────────────────────────────────────────
  router.get('/checkpoints', ...empGuard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const empSnap = await db.collection('employees').doc(uid).get();
      const siteId  = empSnap.exists ? empSnap.data().site_id || null : null;

      let query = db.collection('patrol_checkpoints').where('active', '==', true);
      if (siteId) query = query.where('site_id', '==', siteId);

      const snap  = await query.orderBy('label').limit(100).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, label: d.label, site_name: d.site_name || null, nfc_tag_id: d.nfc_tag_id };
      });

      return res.json(items);
    } catch (err) {
      console.error('patrol/checkpoints error:', err);
      return res.status(500).json({ message: 'Failed to fetch checkpoints.' });
    }
  });

  // ── GET /api/patrol/today ────────────────────────────────────────────────
  router.get('/today', ...empGuard, async (req, res) => {
    const uid = req.user.uid;
    const date = req.query.date || todayStr();

    const dayStart = new Date(date + 'T00:00:00+05:30');
    const dayEnd   = new Date(date + 'T23:59:59+05:30');

    try {
      const snap = await db.collection('patrol_logs')
        .where('guard_uid', '==', uid)
        .where('scanned_at', '>=', dayStart)
        .where('scanned_at', '<=', dayEnd)
        .orderBy('scanned_at', 'asc')
        .limit(200)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:               doc.id,
          checkpoint_label: d.checkpoint_label,
          site_name:        d.site_name || null,
          scanned_at:       d.scanned_at ? d.scanned_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('patrol/today error:', err);
      return res.status(500).json({ message: 'Failed to fetch today\'s patrol log.' });
    }
  });

  // ── Admin: GET /api/admin/patrol/checkpoints ─────────────────────────────
  router.get('/admin/checkpoints', ...adminGuard, async (req, res) => {
    const { site_id } = req.query;
    try {
      let query = db.collection('patrol_checkpoints');
      if (site_id) query = query.where('site_id', '==', site_id);
      const snap  = await query.orderBy('label').limit(500).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return { id: doc.id, label: d.label, site_id: d.site_id, site_name: d.site_name || null, nfc_tag_id: d.nfc_tag_id, active: d.active };
      });
      return res.json(items);
    } catch (err) {
      console.error('patrol/admin/checkpoints GET error:', err);
      return res.status(500).json({ message: 'Failed to fetch checkpoints.' });
    }
  });

  // ── Admin: POST /api/admin/patrol/checkpoints ────────────────────────────
  router.post('/admin/checkpoints', ...adminGuard, async (req, res) => {
    const { label, nfc_tag_id, site_id, site_name } = req.body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ message: 'label is required.' });
    }
    if (!nfc_tag_id || typeof nfc_tag_id !== 'string' || !nfc_tag_id.trim()) {
      return res.status(400).json({ message: 'nfc_tag_id is required.' });
    }

    // Prevent duplicate tag IDs
    const existing = await db.collection('patrol_checkpoints')
      .where('nfc_tag_id', '==', nfc_tag_id.trim())
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ message: 'A checkpoint with this NFC tag ID already exists.' });
    }

    try {
      const ref = await db.collection('patrol_checkpoints').add({
        label:      label.trim(),
        nfc_tag_id: nfc_tag_id.trim(),
        site_id:    site_id || null,
        site_name:  site_name || null,
        active:     true,
        created_at: new Date(),
      });
      return res.status(201).json({ id: ref.id, label: label.trim(), nfc_tag_id: nfc_tag_id.trim() });
    } catch (err) {
      console.error('patrol/admin/checkpoints POST error:', err);
      return res.status(500).json({ message: 'Failed to create checkpoint.' });
    }
  });

  // ── Admin: DELETE /api/admin/patrol/checkpoints/:id ──────────────────────
  router.delete('/admin/checkpoints/:id', ...adminGuard, async (req, res) => {
    try {
      const ref = db.collection('patrol_checkpoints').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: 'Checkpoint not found.' });
      await ref.update({ active: false });   // soft-delete; preserves historical logs
      return res.json({ success: true });
    } catch (err) {
      console.error('patrol/admin/checkpoints DELETE error:', err);
      return res.status(500).json({ message: 'Failed to deactivate checkpoint.' });
    }
  });

  // ── Admin: GET /api/admin/patrol/logs ────────────────────────────────────
  router.get('/admin/logs', ...adminGuard, async (req, res) => {
    const { site_id, guard_uid, date } = req.query;
    const d     = date || todayStr();
    const start = new Date(d + 'T00:00:00+05:30');
    const end   = new Date(d + 'T23:59:59+05:30');

    try {
      let query = db.collection('patrol_logs')
        .where('scanned_at', '>=', start)
        .where('scanned_at', '<=', end)
        .orderBy('scanned_at', 'desc');

      if (site_id)   query = query.where('site_id',   '==', site_id);
      if (guard_uid) query = query.where('guard_uid', '==', guard_uid);

      const snap  = await query.limit(500).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:               doc.id,
          guard_name:       d.guard_name,
          checkpoint_label: d.checkpoint_label,
          site_name:        d.site_name || null,
          scanned_at:       d.scanned_at ? d.scanned_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('patrol/admin/logs error:', err);
      return res.status(500).json({ message: 'Failed to fetch patrol logs.' });
    }
  });

  return { router };
};

// ── Helpers ───────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
