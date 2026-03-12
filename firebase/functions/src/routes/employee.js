/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VAGT Security Services — Employee Portal Routes
 * File: firebase/functions/src/routes/employee.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHO CAN USE THESE ROUTES:
 *   Only logged-in employees (role === 'employee').
 *   Every route checks: valid Firebase token → correct role → then runs.
 *   If a guard's app shows "403 Forbidden", their role claim is wrong — fix
 *   it via: admin.auth().setCustomUserClaims(uid, { role: 'employee' })
 *   then have them sign out and back in to refresh the token.
 *
 * ENDPOINTS IN THIS FILE:
 *   GET  /api/attendance/today         — Did I check in today? What time?
 *   POST /api/attendance/checkin       — Guard taps "Check In"
 *   POST /api/attendance/checkout      — Guard taps "Check Out"
 *   GET  /api/leave/balance            — How many leave days do I have left?
 *   GET  /api/leave/history            — Show me all my leave requests
 *   POST /api/leave/apply              — Apply for leave
 *   GET  /api/payslips                 — List my payslips (last 24 months)
 *   GET  /api/payslips/:id/download    — Download payslip as PDF
 *   GET  /api/employee/schedule        — What shifts am I assigned to?
 *   GET  /api/employee/sites           — Which sites am I deployed at?
 *   GET  /api/employee/incidents       — My filed incident reports
 *   POST /api/employee/incidents       — File a new incident report
 *
 * ATTENDANCE FLOW:
 *   1. Guard opens app → hits GET /attendance/today (shows current status)
 *   2. Guard taps "Check In" → POST /attendance/checkin creates a new log doc
 *   3. At end of shift → POST /attendance/checkout stamps the same doc
 *   4. Log doc: { employee_uid, date (YYYY-MM-DD), site_name, check_in, check_out }
 *
 * LEAVE FLOW:
 *   1. Guard checks GET /leave/balance (3 types: casual, sick, earned)
 *   2. Guard submits POST /leave/apply → status = 'pending'
 *   3. Admin approves/rejects via admin.js → balance is adjusted there
 *   4. Guard sees outcome in GET /leave/history
 *
 * INCIDENT SEVERITY LEVELS:
 *   low      → log only, no immediate alert
 *   medium   → log only, no immediate alert
 *   high     → logged as urgent in activity_log (⚠️ prefix)
 *   critical → logged as urgent in activity_log (⚠️ prefix)
 *   TODO: high + critical should also trigger SMS to admin (wire after MSG91 integration)
 *
 * DEBUG TIPS:
 *   "Already checked in" 409 error: The guard tapped check-in twice.
 *     Check attendance_logs collection in Firestore — find today's doc.
 *   "No check-in found" 400 on checkout: Guard never checked in today.
 *     Or date mismatch — todayStr() uses Cloud Function server time (UTC+0).
 *     The guard's local time in IST is UTC+5:30, so shifts starting after
 *     23:30 IST (midnight UTC) will show as "next day" in Firestore.
 *     FIX: store date in IST by using: todayStr() adjusted to IST (see below).
 *   Leave balance shows 0: The employees doc has no leave_balance field.
 *     Run: db.collection('employees').doc(uid).update({ leave_balance: { casual: 12, sick: 7, earned: 0 } })
 *   Schedule empty: No shifts assigned in the 'shifts' collection for this employee.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express     = require('express');
const PDFDocument = require('pdfkit');
const admin       = require('firebase-admin'); // already initialised in index.js — safe to require again

module.exports = function ({ db, requireAuth, requireEmployee, actionLimiter }) {
  const router = express.Router();

  // Shorthand: every route needs both auth + employee-role check
  const guard  = [requireAuth, requireEmployee];

  // ── GET /api/attendance/today ────────────────────────────────────────────
  // Returns the guard's check-in status for today.
  // The app uses this to show the correct button: "Check In" or "Check Out".
  // Response: { checked_in: bool, time: ISO string or null, site: name or null }
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
        // No log for today — guard hasn't checked in yet
        return res.json({ checked_in: false, time: null, site: null });
      }

      const log = snap.docs[0].data();
      // checked_in = has check_in timestamp but no check_out timestamp
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
  // Creates a new attendance log for today.
  // Fails with 409 Conflict if the guard already checked in today — this
  // prevents accidental duplicate check-ins if the button is tapped twice.
  // Site name is pulled automatically from the employee's profile.
  router.post('/attendance/checkin', ...guard, actionLimiter, async (req, res) => {
    const uid = req.user.uid;
    const today = todayStr();
    try {
      // Safety check: block double check-in
      const existing = await db.collection('attendance_logs')
        .where('employee_uid', '==', uid)
        .where('date', '==', today)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'Already checked in for today.' });
      }

      // Grab the guard's current site from their employee profile
      // (site_name is denormalized here so reports don't need a second lookup)
      const empSnap = await db.collection('employees').doc(uid).get();
      const siteName = empSnap.exists ? (empSnap.data().site_name || null) : null;

      const now = new Date();
      await db.collection('attendance_logs').add({
        employee_uid: uid,
        date: today,
        site_name: siteName,
        check_in: now,
        check_out: null,   // will be filled in when guard checks out
      });

      // Log the activity so admin can see a real-time feed
      await logActivity(db, 'check_in', `${empSnap.exists ? empSnap.data().name : uid} checked in`, uid);

      return res.json({ success: true, time: now.toISOString() });
    } catch (err) {
      console.error('attendance/checkin error:', err);
      return res.status(500).json({ message: 'Check-in failed.' });
    }
  });

  // ── POST /api/attendance/checkout ────────────────────────────────────────
  // Updates today's attendance log with the check-out time.
  // Fails with 400 if there's no check-in for today (guard never checked in).
  // Fails with 409 if already checked out (prevents double checkout).
  router.post('/attendance/checkout', ...guard, actionLimiter, async (req, res) => {
    const uid = req.user.uid;
    const today = todayStr();
    try {
      // Find today's attendance log
      const snap = await db.collection('attendance_logs')
        .where('employee_uid', '==', uid)
        .where('date', '==', today)
        .limit(1)
        .get();

      if (snap.empty) return res.status(400).json({ message: 'No check-in found for today.' });

      const doc = snap.docs[0];
      if (doc.data().check_out) {
        // Guard already checked out — prevent duplicate
        return res.status(409).json({ message: 'Already checked out for today.' });
      }

      const now = new Date();
      // Just stamp the check_out time on the existing doc (don't create a new one)
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
  // Returns the guard's remaining leave days broken down by type.
  // Leave balance is stored directly on the employee document under leave_balance:
  //   { casual: N, sick: N, earned: N }
  // The balance is DECREMENTED by the admin approval route in admin.js when
  // a leave request is approved. It is NOT automatically reset each year yet
  // (TODO: add yearly reset cron job for FY April 1st).
  router.get('/leave/balance', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('employees').doc(uid).get();
      if (!snap.exists) return res.status(404).json({ message: 'Employee record not found.' });

      const lb = snap.data().leave_balance || {};
      // Default to 0 if the field doesn't exist yet
      const casual  = lb.casual  != null ? lb.casual  : 0;
      const sick    = lb.sick    != null ? lb.sick    : 0;
      const earned  = lb.earned  != null ? lb.earned  : 0;

      return res.json({
        balance_days: casual + sick + earned,  // total for the summary card in the app
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
  // Returns the guard's last 50 leave requests (newest first).
  // Statuses: pending → approved or rejected (set by admin in admin.js)
  router.get('/leave/history', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('leave_requests')
        .where('employee_uid', '==', uid)
        .orderBy('applied_at', 'desc')
        .limit(50)   // 50 is plenty; guards rarely apply for more than a few per year
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
  // Guard submits a leave request. Status starts as 'pending'.
  // Admin sees it under GET /admin/pending-leaves and can approve/reject.
  // When approved, admin.js decrements the leave_balance on the employee doc.
  //
  // Required body: { leave_type, from_date, to_date, reason }
  //   leave_type: 'casual' | 'sick' | 'earned'
  //   from_date / to_date: 'YYYY-MM-DD' strings
  //
  // NOTE: We do NOT currently check if the guard has enough balance left —
  // if balance is 0 the request still goes in as 'pending'.
  // The admin should reject it if there's no balance. Consider adding a
  // balance check here in the future.
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
        status: 'pending',    // admin will change this to 'approved' or 'rejected'
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
  // Returns the guard's last 24 payslips (2 years of history).
  // Payslips are created by the admin POST /admin/payroll/run endpoint.
  // Each payslip has a pdf_url field — if null, the PDF hasn't been generated yet.
  //
  // Payslip period format: 'YYYY-MM' (e.g. '2026-03' for March 2026)
  // We convert this to a human label like "March 2026" using India locale (en-IN).
  router.get('/payslips', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('payslips')
        .where('employee_uid', '==', uid)
        .orderBy('period', 'desc')   // newest first — 'YYYY-MM' sorts correctly as a string
        .limit(24)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        const [year, month] = (d.period || '').split('-');
        // Convert '2026-03' → 'March 2026' using Indian locale
        const monthLabel = month && year
          ? new Date(year, parseInt(month, 10) - 1).toLocaleString('en-IN', { month: 'long' }) + ' ' + year
          : d.period;
        return {
          id: doc.id,
          month: month ? parseInt(month, 10) : null,
          year: year ? parseInt(year, 10) : null,
          month_label: monthLabel,
          net_pay: d.net_pay || 0,
          url: d.pdf_url || null,  // null = no PDF yet; app should show "Not available"
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('payslips error:', err);
      return res.status(500).json({ message: 'Failed to fetch payslips.' });
    }
  });

  // ── GET /api/payslips/:id/download ──────────────────────────────────────
  // First call: generates PDF with pdfkit, stores it in Firebase Storage, serves it.
  // Subsequent calls: retrieves the stored PDF from Storage — no pdfkit needed.
  // Storage path: payslips/{payslipId}.pdf
  router.get('/payslips/:id/download', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const slipSnap = await db.collection('payslips').doc(req.params.id).get();
      if (!slipSnap.exists) return res.status(404).json({ message: 'Payslip not found.' });

      const d = slipSnap.data();
      if (d.employee_uid !== uid) return res.status(403).json({ message: 'Access denied.' });

      const filename = `VAGT-Payslip-${d.employee_id || uid}-${d.period || 'slip'}.pdf`;

      // ── Serve from Storage if already generated ────────────────────────
      if (d.pdf_path) {
        const [pdfBuf] = await admin.storage().bucket().file(d.pdf_path).download();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuf.length);
        return res.end(pdfBuf);
      }

      // ── Parse period (YYYY-MM) into a human label ──────────────────────
      const [year, month] = (d.period || '').split('-');
      const monthLabel = month && year
        ? new Date(year, parseInt(month, 10) - 1).toLocaleString('en-IN', { month: 'long' }) + ' ' + year
        : (d.period || '');

      const generatedDate = d.generated_at
        ? d.generated_at.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      // ── Build PDF in memory ──────────────────────────────────────────────
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));

      await new Promise((resolve, reject) => {
        doc.on('end',   resolve);
        doc.on('error', reject);

        const NAVY   = '#0a1628';
        const AMBER  = '#f59e0b';
        const MID    = '#555e6d';
        const FAINT  = '#9aa3ae';
        const BORDER = '#e2e6ea';

        // Header band
        doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
        doc.fill('#ffffff').font('Helvetica-Bold').fontSize(22).text('VAGT', 50, 28);
        doc.fill(AMBER).font('Helvetica').fontSize(10).text('Security Services', 50, 54);
        doc.fill('#ffffff').font('Helvetica').fontSize(10)
          .text('PAYSLIP', 0, 38, { align: 'right', width: doc.page.width - 50 });
        doc.fill(AMBER).font('Helvetica-Bold').fontSize(13)
          .text(monthLabel, 0, 54, { align: 'right', width: doc.page.width - 50 });

        // Employee details box
        doc.roundedRect(50, 108, doc.page.width - 100, 80, 4).stroke(BORDER);
        doc.fill(NAVY).font('Helvetica-Bold').fontSize(11)
          .text(d.employee_name || '—', 66, 120);
        doc.fill(MID).font('Helvetica').fontSize(9)
          .text('Employee ID: ' + (d.employee_id || '—'), 66, 136)
          .text('Generated: ' + generatedDate, 66, 150)
          .text('Period: ' + monthLabel, 66, 164);

        // Earnings table header
        const tableTop = 214;
        doc.rect(50, tableTop, doc.page.width - 100, 24).fill('#f1f4f8');
        doc.fill(NAVY).font('Helvetica-Bold').fontSize(9)
          .text('EARNINGS',   66,  tableTop + 8)
          .text('AMOUNT (₹)', 380, tableTop + 8);

        // Rows
        let y = tableTop + 34;
        const rowH = 22;
        const rows = [
          ['Basic Salary', d.basic || 0],
          ['Allowances',   d.allowances || 0],
        ];
        rows.forEach(([label, amount]) => {
          doc.fill('#444').font('Helvetica').fontSize(9)
            .text(label, 66, y)
            .text('₹ ' + Number(amount).toLocaleString('en-IN'), 380, y);
          doc.moveTo(50, y + rowH - 2).lineTo(doc.page.width - 50, y + rowH - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
          y += rowH;
        });

        // Gross pay row
        y += 6;
        doc.rect(50, y, doc.page.width - 100, 24).fill('#f7f9fb');
        doc.fill(NAVY).font('Helvetica-Bold').fontSize(9)
          .text('Gross Pay', 66, y + 8)
          .text('₹ ' + Number(d.gross_pay || 0).toLocaleString('en-IN'), 380, y + 8);
        y += 34;

        // Deductions section
        doc.rect(50, y, doc.page.width - 100, 24).fill('#f1f4f8');
        doc.fill(NAVY).font('Helvetica-Bold').fontSize(9)
          .text('DEDUCTIONS', 66, y + 8)
          .text('AMOUNT (₹)', 380, y + 8);
        y += 34;
        doc.fill('#444').font('Helvetica').fontSize(9)
          .text('Total Deductions', 66, y)
          .text('₹ ' + Number(d.deductions || 0).toLocaleString('en-IN'), 380, y);
        doc.moveTo(50, y + rowH - 2).lineTo(doc.page.width - 50, y + rowH - 2).strokeColor(BORDER).lineWidth(0.5).stroke();
        y += rowH + 14;

        // Net pay box
        doc.rect(50, y, doc.page.width - 100, 40).fill(NAVY);
        doc.fill('#ffffff').font('Helvetica').fontSize(10).text('NET PAY', 66, y + 13);
        doc.fill(AMBER).font('Helvetica-Bold').fontSize(14)
          .text('₹ ' + Number(d.net_pay || 0).toLocaleString('en-IN'), 0, y + 11, { align: 'right', width: doc.page.width - 66 });

        // Footer
        doc.fill(FAINT).font('Helvetica').fontSize(8)
          .text('This is a computer-generated payslip. No signature required.', 50, doc.page.height - 60, { align: 'center', width: doc.page.width - 100 })
          .text('VAGT Security Services Pvt. Ltd. · Bengaluru, Karnataka', 50, doc.page.height - 46, { align: 'center', width: doc.page.width - 100 });

        doc.end();
      });

      const pdfBuf     = Buffer.concat(chunks);
      const storagePath = `payslips/${req.params.id}.pdf`;

      // ── Store in Firebase Storage (fire-and-forget on failure — still serve the PDF) ──
      try {
        await admin.storage().bucket().file(storagePath).save(pdfBuf, {
          metadata: { contentType: 'application/pdf' },
        });
        await db.collection('payslips').doc(req.params.id).update({ pdf_path: storagePath });
      } catch (storeErr) {
        // Storage failure is non-fatal — guard still gets their payslip; will retry next download
        console.error('payslip storage save failed (non-fatal):', storeErr);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuf.length);
      return res.end(pdfBuf);
    } catch (err) {
      console.error('payslips/download error:', err);
      return res.status(500).json({ message: 'Failed to generate payslip PDF.' });
    }
  });

  // ── GET /api/employee/schedule ───────────────────────────────────────────
  // Returns the guard's upcoming shifts.
  // Two modes:
  //   ?week_start=YYYY-MM-DD  → Return exactly 7 days of shifts from that date
  //   (no param)              → Return next 14 days from today
  //
  // Shifts are created by the admin via POST /admin/schedule in admin.js.
  // Shift data lives in the 'shifts' Firestore collection.
  //
  // NOTE: If you add a Firestore composite index for (employee_uid, date),
  // this query will be significantly faster. Currently using default indexes.
  router.get('/employee/schedule', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const weekStart = req.query.week_start;
    try {
      let query = db.collection('shifts')
        .where('employee_uid', '==', uid)
        .orderBy('date');

      if (weekStart) {
        // Calculate the end date (7 days after week_start)
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 7);
        const endStr = end.toISOString().slice(0, 10);
        query = query.where('date', '>=', weekStart).where('date', '<', endStr);
      } else {
        // Default: next 14 days from today (covers 2 weeks of rota)
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
          shift_type: d.shift_type,    // e.g. 'morning', 'evening', 'night'
          start_time: d.start_time,    // e.g. '06:00'
          end_time: d.end_time,        // e.g. '14:00'
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('employee/schedule error:', err);
      return res.status(500).json({ message: 'Failed to fetch schedule.' });
    }
  });

  // ── GET /api/employee/sites ───────────────────────────────────────────────
  // Returns the sites this guard is currently deployed at.
  // The guard's employee doc has a site_ids array. We fetch each site doc to
  // get its name.
  //
  // NOTE: This uses Promise.all — all site fetches run in parallel.
  // If a site_id in the array doesn't exist in Firestore, it's silently skipped.
  // This can happen if a site is deleted without cleaning up employee records.
  router.get('/employee/sites', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const empSnap = await db.collection('employees').doc(uid).get();
      if (!empSnap.exists) return res.json([]);  // Employee doc not found — return empty

      const siteIds = empSnap.data().site_ids || [];
      if (siteIds.length === 0) return res.json([]);  // Guard not assigned to any site

      // Fetch all site docs in parallel (faster than fetching one by one)
      const siteSnaps = await Promise.all(
        siteIds.map(id => db.collection('sites').doc(id).get())
      );

      const sites = siteSnaps
        .filter(s => s.exists)   // ignore deleted/missing sites
        .map(s => ({ id: s.id, name: s.data().name }));

      return res.json(sites);
    } catch (err) {
      console.error('employee/sites error:', err);
      return res.status(500).json({ message: 'Failed to fetch sites.' });
    }
  });

  // ── GET /api/employee/incidents ──────────────────────────────────────────
  // Returns the guard's filed incident reports (last 50, newest first).
  // Used to show the guard their own incident history in the app.
  // Incidents filed by other guards at the same site are NOT returned here —
  // this is personal history only.
  //
  // TYPE_LABELS maps the stored enum values to readable strings for the UI.
  router.get('/employee/incidents', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('incidents')
        .where('employee_uid', '==', uid)
        .orderBy('submitted_at', 'desc')
        .limit(50)
        .get();

      // Human-readable labels for each incident type
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
          // reference_number is like "INC-2026-3421" — unique per incident
          reference_number: d.reference_number || `INC-${doc.id.slice(0, 8).toUpperCase()}`,
          type: d.type,
          type_label: TYPE_LABELS[d.type] || d.type,
          severity: d.severity,
          site_name: d.site_name || null,
          occurred_at: d.occurred_at ? d.occurred_at.toDate().toISOString() : null,
          status: d.status,  // 'submitted', 'acknowledged', 'resolved'
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
  // Guard files a new incident report.
  //
  // Required body: { type, severity, description }
  // Optional body: { site_id, occurred_at, persons_involved, action_taken }
  //
  // HIGH + CRITICAL INCIDENTS:
  //   These are flagged with ⚠️ in the activity log so admins see them first
  //   in the real-time feed. TODO: once MSG91 is wired, also fire an SMS alert
  //   to the duty manager's phone for high/critical incidents.
  //
  // REFERENCE NUMBER FORMAT: INC-{year}-{4 random digits}
  //   e.g. INC-2026-7382
  //   Not 100% collision-proof at high volume (use UUID-based approach if
  //   filing >1000 incidents/year). Fine for current scale.
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
      // Fetch guard name and site name for denormalization
      // (so admin queries don't need extra lookups to show incident lists)
      const empSnap = await db.collection('employees').doc(uid).get();
      const empName = empSnap.exists ? empSnap.data().name : null;

      let siteName = null;
      if (site_id) {
        const siteSnap = await db.collection('sites').doc(site_id).get();
        siteName = siteSnap.exists ? siteSnap.data().name : null;
      }

      // Generate a short, human-readable reference number
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
        occurred_at: occurred_at ? new Date(occurred_at) : now,  // use provided time or right now
        description,
        persons_involved: persons_involved || null,
        action_taken: action_taken || null,
        reference_number: refNum,
        status: 'submitted',   // admin changes this to 'acknowledged' or 'resolved'
        submitted_at: now,
      });

      // Escalate high/critical incidents visually in the activity log
      if (['high', 'critical'].includes(severity)) {
        await logActivity(db, 'other', `⚠️ ${severity.toUpperCase()} incident filed by ${empName || uid}: ${refNum}`, uid);
        // TODO: Send SMS/push notification to admin when MSG91 is wired
        //   Example: await sendSms(adminPhone, `VAGT ALERT: ${severity} incident ${refNum} at ${siteName}`)
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

// Returns today's date as 'YYYY-MM-DD' using the Cloud Function server's timezone (UTC).
// ⚠️ KNOWN ISSUE: Cloud Functions run in UTC. IST is UTC+5:30. This means a guard
// checking in at 11:30 PM IST (= 6:00 PM UTC) will get date X, but a guard checking
// in at 12:30 AM IST (= 7:00 PM UTC the SAME UTC day) will also get date X instead
// of date X+1. For most day shifts this doesn't matter. Night shift guards crossing
// midnight IST may see incorrect date on their check-in. Fix: convert to IST here.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Writes a line to the activity_log collection so the admin dashboard can
// show a real-time feed of what's happening. Failures here are non-fatal —
// we warn in logs but don't break the main operation.
async function logActivity(db, type, description, actor) {
  try {
    await db.collection('activity_log').add({ type, description, actor, time: new Date() });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
