/**
 * Employee portal routes (self-service)
 *
 * All routes require a valid Firebase ID token with role === 'employee'.
 *
 * GET  /api/attendance/today
 * POST /api/attendance/checkin
 * POST /api/attendance/checkout
 * GET  /api/leave/balance
 * GET  /api/leave/history
 * POST /api/leave/apply
 * GET  /api/payslips
 * GET  /api/employee/schedule
 * GET  /api/employee/sites
 * GET  /api/employee/incidents
 * POST /api/employee/incidents
 */

'use strict';

const express = require('express');

module.exports = function ({ db, requireAuth, requireEmployee }) {
  const router = express.Router();
  const guard  = [requireAuth, requireEmployee];

  // ── GET /api/attendance/today ────────────────────────────────────────────
  router.get('/attendance/today', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const today = todayStr();
    try {
      const snap = await db.collection('attendance_logs')
        .where('employee_uid', '==', uid)
        .where('date', '==', today)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ checked_in: false, time: null, site: null });
      }

      const log = snap.docs[0].data();
      const checkedIn = !!log.check_in && !log.check_out;
      return res.json({
        checked_in: checkedIn,
        time: log.check_in ? log.check_in.toDate().toISOString() : null,
        check_out: log.check_out ? log.check_out.toDate().toISOString() : null,
        site: log.site_name || null,
      });
    } catch (err) {
      console.error('attendance/today error:', err);
      return res.status(500).json({ message: 'Failed to fetch attendance.' });
    }
  });

  // ── POST /api/attendance/checkin ─────────────────────────────────────────
  router.post('/attendance/checkin', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const today = todayStr();
    try {
      // Prevent double check-in
      const existing = await db.collection('attendance_logs')
        .where('employee_uid', '==', uid)
        .where('date', '==', today)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'Already checked in for today.' });
      }

      // Get employee's current site
      const empSnap = await db.collection('employees').doc(uid).get();
      const siteName = empSnap.exists ? (empSnap.data().site_name || null) : null;

      const now = new Date();
      await db.collection('attendance_logs').add({
        employee_uid: uid,
        date: today,
        site_name: siteName,
        check_in: now,
        check_out: null,
      });

      // Activity log
      await logActivity(db, 'check_in', `${empSnap.exists ? empSnap.data().name : uid} checked in`, uid);

      return res.json({ success: true, time: now.toISOString() });
    } catch (err) {
      console.error('attendance/checkin error:', err);
      return res.status(500).json({ message: 'Check-in failed.' });
    }
  });

  // ── POST /api/attendance/checkout ────────────────────────────────────────
  router.post('/attendance/checkout', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const today = todayStr();
    try {
      const snap = await db.collection('attendance_logs')
        .where('employee_uid', '==', uid)
        .where('date', '==', today)
        .limit(1)
        .get();

      if (snap.empty) return res.status(400).json({ message: 'No check-in found for today.' });

      const doc = snap.docs[0];
      if (doc.data().check_out) {
        return res.status(409).json({ message: 'Already checked out for today.' });
      }

      const now = new Date();
      await doc.ref.update({ check_out: now });

      const empSnap = await db.collection('employees').doc(uid).get();
      await logActivity(db, 'check_out', `${empSnap.exists ? empSnap.data().name : uid} checked out`, uid);

      return res.json({ success: true, time: now.toISOString() });
    } catch (err) {
      console.error('attendance/checkout error:', err);
      return res.status(500).json({ message: 'Check-out failed.' });
    }
  });

  // ── GET /api/leave/balance ───────────────────────────────────────────────
  router.get('/leave/balance', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('employees').doc(uid).get();
      if (!snap.exists) return res.status(404).json({ message: 'Employee record not found.' });

      const lb = snap.data().leave_balance || {};
      const casual  = lb.casual  != null ? lb.casual  : 0;
      const sick    = lb.sick    != null ? lb.sick    : 0;
      const earned  = lb.earned  != null ? lb.earned  : 0;

      return res.json({
        balance_days: casual + sick + earned,
        leave_types: [
          { type: 'casual', label: 'Casual Leave',  balance: casual },
          { type: 'sick',   label: 'Sick Leave',    balance: sick   },
          { type: 'earned', label: 'Earned Leave',  balance: earned },
        ],
      });
    } catch (err) {
      console.error('leave/balance error:', err);
      return res.status(500).json({ message: 'Failed to fetch leave balance.' });
    }
  });

  // ── GET /api/leave/history ───────────────────────────────────────────────
  router.get('/leave/history', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('leave_requests')
        .where('employee_uid', '==', uid)
        .orderBy('applied_at', 'desc')
        .limit(50)
        .get();

      const LABELS = { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave' };

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          leave_type: d.leave_type,
          leave_type_label: LABELS[d.leave_type] || d.leave_type,
          from_date: d.from_date,
          to_date: d.to_date,
          reason: d.reason,
          status: d.status,
          applied_at: d.applied_at ? d.applied_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('leave/history error:', err);
      return res.status(500).json({ message: 'Failed to fetch leave history.' });
    }
  });

  // ── POST /api/leave/apply ────────────────────────────────────────────────
  router.post('/leave/apply', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { leave_type, from_date, to_date, reason } = req.body || {};

    if (!leave_type || !from_date || !to_date || !reason) {
      return res.status(400).json({ message: 'leave_type, from_date, to_date, and reason are required.' });
    }
    if (!['casual', 'sick', 'earned'].includes(leave_type)) {
      return res.status(400).json({ message: 'leave_type must be casual, sick, or earned.' });
    }

    try {
      const ref = await db.collection('leave_requests').add({
        employee_uid: uid,
        leave_type,
        from_date,
        to_date,
        reason,
        status: 'pending',
        applied_at: new Date(),
      });

      const empSnap = await db.collection('employees').doc(uid).get();
      await logActivity(db, 'leave_request', `${empSnap.exists ? empSnap.data().name : uid} applied for ${leave_type} leave`, uid);

      return res.status(201).json({ id: ref.id, status: 'pending' });
    } catch (err) {
      console.error('leave/apply error:', err);
      return res.status(500).json({ message: 'Failed to submit leave request.' });
    }
  });

  // ── GET /api/payslips ────────────────────────────────────────────────────
  router.get('/payslips', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('payslips')
        .where('employee_uid', '==', uid)
        .orderBy('period', 'desc')
        .limit(24)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        const [year, month] = (d.period || '').split('-');
        const monthLabel = month && year
          ? new Date(year, parseInt(month, 10) - 1).toLocaleString('en-IN', { month: 'long' }) + ' ' + year
          : d.period;
        return {
          id: doc.id,
          month: month ? parseInt(month, 10) : null,
          year: year ? parseInt(year, 10) : null,
          month_label: monthLabel,
          net_pay: d.net_pay || 0,
          url: d.pdf_url || null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('payslips error:', err);
      return res.status(500).json({ message: 'Failed to fetch payslips.' });
    }
  });

  // ── GET /api/employee/schedule ───────────────────────────────────────────
  router.get('/employee/schedule', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const weekStart = req.query.week_start;
    try {
      let query = db.collection('shifts')
        .where('employee_uid', '==', uid)
        .orderBy('date');

      if (weekStart) {
        // Return shifts for the week starting at week_start (7 days)
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 7);
        const endStr = end.toISOString().slice(0, 10);
        query = query.where('date', '>=', weekStart).where('date', '<', endStr);
      } else {
        // Default: next 14 days
        query = query.where('date', '>=', todayStr()).limit(14);
      }

      const snap = await query.get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date,
          site_name: d.site_name,
          site_address: d.site_address || null,
          shift_type: d.shift_type,
          start_time: d.start_time,
          end_time: d.end_time,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('employee/schedule error:', err);
      return res.status(500).json({ message: 'Failed to fetch schedule.' });
    }
  });

  // ── GET /api/employee/sites ───────────────────────────────────────────────
  router.get('/employee/sites', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const empSnap = await db.collection('employees').doc(uid).get();
      if (!empSnap.exists) return res.json([]);

      const siteIds = empSnap.data().site_ids || [];
      if (siteIds.length === 0) return res.json([]);

      const siteSnaps = await Promise.all(
        siteIds.map(id => db.collection('sites').doc(id).get())
      );

      const sites = siteSnaps
        .filter(s => s.exists)
        .map(s => ({ id: s.id, name: s.data().name }));

      return res.json(sites);
    } catch (err) {
      console.error('employee/sites error:', err);
      return res.status(500).json({ message: 'Failed to fetch sites.' });
    }
  });

  // ── GET /api/employee/incidents ──────────────────────────────────────────
  router.get('/employee/incidents', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('incidents')
        .where('employee_uid', '==', uid)
        .orderBy('submitted_at', 'desc')
        .limit(50)
        .get();

      const TYPE_LABELS = {
        trespassing:        'Trespassing / Unauthorised Entry',
        suspicious_activity:'Suspicious Activity',
        theft:              'Theft / Stolen Property',
        fire:               'Fire / Smoke / Hazard',
        equipment_failure:  'Equipment Failure',
        medical:            'Medical Emergency',
        other:              'Other',
      };

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          reference_number: d.reference_number || `INC-${doc.id.slice(0, 8).toUpperCase()}`,
          type: d.type,
          type_label: TYPE_LABELS[d.type] || d.type,
          severity: d.severity,
          site_name: d.site_name || null,
          occurred_at: d.occurred_at ? d.occurred_at.toDate().toISOString() : null,
          status: d.status,
          submitted_at: d.submitted_at ? d.submitted_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('employee/incidents GET error:', err);
      return res.status(500).json({ message: 'Failed to fetch incidents.' });
    }
  });

  // ── POST /api/employee/incidents ─────────────────────────────────────────
  router.post('/employee/incidents', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { type, severity, site_id, occurred_at, description, persons_involved, action_taken } = req.body || {};

    if (!type || !severity || !description) {
      return res.status(400).json({ message: 'type, severity, and description are required.' });
    }
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      return res.status(400).json({ message: 'severity must be low, medium, high, or critical.' });
    }

    try {
      // Fetch employee and site names for denormalization
      const empSnap = await db.collection('employees').doc(uid).get();
      const empName = empSnap.exists ? empSnap.data().name : null;

      let siteName = null;
      if (site_id) {
        const siteSnap = await db.collection('sites').doc(site_id).get();
        siteName = siteSnap.exists ? siteSnap.data().name : null;
      }

      const year = new Date().getFullYear();
      const refNum = `INC-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

      const now = new Date();
      const ref = await db.collection('incidents').add({
        employee_uid: uid,
        employee_name: empName,
        type,
        severity,
        site_id: site_id || null,
        site_name: siteName,
        occurred_at: occurred_at ? new Date(occurred_at) : now,
        description,
        persons_involved: persons_involved || null,
        action_taken: action_taken || null,
        reference_number: refNum,
        status: 'submitted',
        submitted_at: now,
      });

      // Notify admin immediately for high/critical severity
      if (['high', 'critical'].includes(severity)) {
        await logActivity(db, 'other', `⚠️ ${severity.toUpperCase()} incident filed by ${empName || uid}: ${refNum}`, uid);
        // TODO: Send SMS/push notification to admin
      } else {
        await logActivity(db, 'other', `Incident filed by ${empName || uid}: ${refNum}`, uid);
      }

      return res.status(201).json({ id: ref.id, reference_number: refNum, status: 'submitted' });
    } catch (err) {
      console.error('employee/incidents POST error:', err);
      return res.status(500).json({ message: 'Failed to file incident.' });
    }
  });

  return { router };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function logActivity(db, type, description, actor) {
  try {
    await db.collection('activity_log').add({ type, description, actor, time: new Date() });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
