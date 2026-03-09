/**
 * Admin portal routes
 *
 * All routes require a valid Firebase ID token with role === 'admin'.
 *
 * GET  /api/admin/overview
 * GET  /api/admin/activity
 * GET  /api/admin/pending-registrations
 * POST /api/admin/registrations/:id/approve
 * POST /api/admin/registrations/:id/reject
 * GET  /api/admin/pending-leaves
 * POST /api/admin/leaves/:id/approve
 * POST /api/admin/leaves/:id/reject
 * GET  /api/admin/employees
 * GET  /api/admin/employees/:id
 * POST /api/admin/employees/:id/deactivate
 * POST /api/admin/employees/:id/reactivate
 * GET  /api/admin/schedule
 * POST /api/admin/schedule
 * DELETE /api/admin/schedule/:id
 * GET  /api/admin/clients
 * GET  /api/admin/clients/:id
 * GET  /api/admin/sites
 * GET  /api/admin/sites/:id
 * GET  /api/admin/payroll
 * POST /api/admin/payroll/run
 * POST /api/admin/payroll/:employee_id/generate-slip
 * GET  /api/admin/complaints
 * GET  /api/admin/complaints/:id
 * POST /api/admin/complaints/:id/status
 * GET  /api/admin/reports
 */

'use strict';

const express = require('express');

module.exports = function ({ db, auth, requireAuth, requireAdmin }) {
  const router = express.Router();
  const guard  = [requireAuth, requireAdmin];

  // ── GET /overview ────────────────────────────────────────────────────────
  router.get('/overview', ...guard, async (req, res) => {
    try {
      const [empSnap, pendingRegSnap, openTicketsSnap, pendingLeavesSnap, attendanceSnap] = await Promise.all([
        db.collection('employees').get(),
        db.collection('pending_registrations').where('verified', '==', true).get(),
        db.collection('complaints').where('status', 'in', ['open', 'in_progress']).get(),
        db.collection('leave_requests').where('status', '==', 'pending').get(),
        db.collection('attendance_logs').where('date', '==', todayStr()).get(),
      ]);

      const employees = empSnap.docs.map(d => d.data());
      const active    = employees.filter(e => e.status === 'active').length;
      const pending   = employees.filter(e => e.status === 'pending').length;
      const checkedIn = attendanceSnap.docs.filter(d => d.data().check_in && !d.data().check_out).length;
      const onDuty    = attendanceSnap.size;

      const openTickets    = openTicketsSnap.docs;
      const urgentTickets  = openTickets.filter(d => d.data().priority === 'urgent').length;
      const inProgressTickets = openTickets.filter(d => d.data().status === 'in_progress').length;

      return res.json({
        employees: { active, pending_approval: pendingRegSnap.size + pending, total: empSnap.size },
        attendance: { checked_in: checkedIn, total_on_duty: onDuty },
        tickets:    { open: openTickets.length, in_progress: inProgressTickets, urgent: urgentTickets },
        leaves:     { pending: pendingLeavesSnap.size },
      });
    } catch (err) {
      console.error('admin/overview error:', err);
      return res.status(500).json({ message: 'Failed to fetch overview.' });
    }
  });

  // ── GET /activity ────────────────────────────────────────────────────────
  router.get('/activity', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('activity_log')
        .orderBy('time', 'desc')
        .limit(50)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          type: d.type,
          description: d.description,
          time: d.time ? d.time.toDate().toISOString() : null,
          actor: d.actor,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('admin/activity error:', err);
      return res.status(500).json({ message: 'Failed to fetch activity.' });
    }
  });

  // ── GET /pending-registrations ───────────────────────────────────────────
  router.get('/pending-registrations', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('pending_registrations')
        .where('verified', '==', true)
        .orderBy('verified_at', 'desc')
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || null,
          phone: d.phone,
          aadhaar_last4: d.aadhaar_last4 || null,
          applied_at: d.created_at ? d.created_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('pending-registrations error:', err);
      return res.status(500).json({ message: 'Failed to fetch registrations.' });
    }
  });

  // ── POST /registrations/:id/approve ─────────────────────────────────────
  router.post('/registrations/:id/approve', ...guard, async (req, res) => {
    const { id } = req.params;
    try {
      const regRef  = db.collection('pending_registrations').doc(id);
      const regSnap = await regRef.get();
      if (!regSnap.exists) return res.status(404).json({ message: 'Registration not found.' });

      const reg = regSnap.data();
      if (reg.approved) return res.status(409).json({ message: 'Already approved.' });

      // Create Firebase Auth account
      const userRecord = await auth.createUser({
        email: reg.email,
        password: reg.password_hash,       // TODO: require password reset on first login
        displayName: reg.name || reg.phone,
        phoneNumber: reg.phone,
      });

      // Set custom role claim
      await auth.setCustomUserClaims(userRecord.uid, { role: 'employee' });

      // Create Firestore employee document
      const empId = await nextEmployeeId(db);
      await db.collection('employees').doc(userRecord.uid).set({
        name: reg.name || reg.phone,
        phone: reg.phone,
        email: reg.email,
        employee_id: empId,
        status: 'active',
        leave_balance: { casual: 6, sick: 4, earned: 2 },
        site_ids: [],
        joined_at: new Date(),
      });

      await regRef.update({ approved: true, approved_at: new Date(), uid: userRecord.uid });

      await logActivity(db, 'registration', `Employee ${empId} (${reg.phone}) approved`, 'admin');

      // TODO: Send credentials via SMS
      console.info(`[approve] Created employee ${empId}, uid: ${userRecord.uid}`);

      return res.json({ success: true });
    } catch (err) {
      console.error('registrations/approve error:', err);
      return res.status(500).json({ message: 'Failed to approve registration.' });
    }
  });

  // ── POST /registrations/:id/reject ───────────────────────────────────────
  router.post('/registrations/:id/reject', ...guard, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    try {
      const regRef = db.collection('pending_registrations').doc(id);
      const snap   = await regRef.get();
      if (!snap.exists) return res.status(404).json({ message: 'Registration not found.' });

      await regRef.update({ rejected: true, reject_reason: reason || null, rejected_at: new Date() });
      await logActivity(db, 'registration', `Registration for ${snap.data().phone} rejected`, 'admin');

      return res.json({ success: true });
    } catch (err) {
      console.error('registrations/reject error:', err);
      return res.status(500).json({ message: 'Failed to reject registration.' });
    }
  });

  // ── GET /pending-leaves ──────────────────────────────────────────────────
  router.get('/pending-leaves', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('leave_requests')
        .where('status', '==', 'pending')
        .orderBy('applied_at', 'asc')
        .get();

      const LABELS = { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave' };

      // Enrich with employee names (batch)
      const items = await Promise.all(snap.docs.map(async doc => {
        const d = doc.data();
        const empSnap = await db.collection('employees').doc(d.employee_uid).get();
        const emp = empSnap.exists ? empSnap.data() : {};
        return {
          id: doc.id,
          employee_id: emp.employee_id || null,
          employee_name: emp.name || d.employee_uid,
          leave_type: d.leave_type,
          leave_type_label: LABELS[d.leave_type] || d.leave_type,
          from_date: d.from_date,
          to_date: d.to_date,
          reason: d.reason,
          applied_at: d.applied_at ? d.applied_at.toDate().toISOString() : null,
        };
      }));

      return res.json(items);
    } catch (err) {
      console.error('admin/pending-leaves error:', err);
      return res.status(500).json({ message: 'Failed to fetch pending leaves.' });
    }
  });

  // ── POST /leaves/:id/approve ─────────────────────────────────────────────
  router.post('/leaves/:id/approve', ...guard, async (req, res) => {
    await setLeaveStatus(db, req.params.id, 'approved', res);
  });

  // ── POST /leaves/:id/reject ──────────────────────────────────────────────
  router.post('/leaves/:id/reject', ...guard, async (req, res) => {
    await setLeaveStatus(db, req.params.id, 'rejected', res);
  });

  // ── GET /employees ───────────────────────────────────────────────────────
  router.get('/employees', ...guard, async (req, res) => {
    const { status } = req.query;
    try {
      let query = db.collection('employees').orderBy('name');
      if (status) query = query.where('status', '==', status);

      const snap = await query.get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          employee_id: d.employee_id,
          name: d.name,
          phone: d.phone,
          email: d.email || null,
          site_name: d.site_name || null,
          status: d.status,
          joined_at: d.joined_at ? d.joined_at.toDate().toISOString() : null,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/employees error:', err);
      return res.status(500).json({ message: 'Failed to fetch employees.' });
    }
  });

  // ── GET /employees/:id ───────────────────────────────────────────────────
  router.get('/employees/:id', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('employees').doc(req.params.id).get();
      if (!snap.exists) return res.status(404).json({ message: 'Employee not found.' });
      const d = snap.data();
      return res.json({
        id: snap.id,
        employee_id: d.employee_id,
        name: d.name,
        phone: d.phone,
        email: d.email || null,
        site_name: d.site_name || null,
        status: d.status,
        joined_at: d.joined_at ? d.joined_at.toDate().toISOString() : null,
        aadhaar_last4: d.aadhaar_last4 || null,
        address: d.address || null,
        emergency_contact: d.emergency_contact || null,
        leave_balance: d.leave_balance || {},
        attendance_rate: d.attendance_rate || null,
      });
    } catch (err) {
      console.error('admin/employees/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch employee.' });
    }
  });

  // ── POST /employees/:id/deactivate ───────────────────────────────────────
  router.post('/employees/:id/deactivate', ...guard, async (req, res) => {
    await setEmployeeStatus(db, auth, req.params.id, 'inactive', res);
  });

  // ── POST /employees/:id/reactivate ───────────────────────────────────────
  router.post('/employees/:id/reactivate', ...guard, async (req, res) => {
    await setEmployeeStatus(db, auth, req.params.id, 'active', res);
  });

  // ── GET /schedule ────────────────────────────────────────────────────────
  router.get('/schedule', ...guard, async (req, res) => {
    const { week_start } = req.query;
    try {
      let query = db.collection('shifts').orderBy('date');
      if (week_start) {
        const end = new Date(week_start);
        end.setDate(end.getDate() + 7);
        const endStr = end.toISOString().slice(0, 10);
        query = query.where('date', '>=', week_start).where('date', '<', endStr);
      } else {
        query = query.where('date', '>=', todayStr()).limit(100);
      }

      const snap = await query.get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          employee_id: d.employee_id,
          employee_name: d.employee_name,
          site_id: d.site_id,
          site_name: d.site_name,
          date: d.date,
          shift_type: d.shift_type,
          start_time: d.start_time,
          end_time: d.end_time,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/schedule GET error:', err);
      return res.status(500).json({ message: 'Failed to fetch schedule.' });
    }
  });

  // ── POST /schedule ───────────────────────────────────────────────────────
  router.post('/schedule', ...guard, async (req, res) => {
    const { employee_id, site_id, date, shift_type } = req.body || {};
    if (!employee_id || !site_id || !date || !shift_type) {
      return res.status(400).json({ message: 'employee_id, site_id, date, and shift_type are required.' });
    }

    try {
      // Check for existing shift on same day
      const existing = await db.collection('shifts')
        .where('employee_uid', '==', employee_id)
        .where('date', '==', date)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'Employee already has a shift on this date.' });
      }

      // Fetch employee and site names
      const [empSnap, siteSnap] = await Promise.all([
        db.collection('employees').doc(employee_id).get(),
        db.collection('sites').doc(site_id).get(),
      ]);

      const SHIFT_TIMES = {
        morning:   { start: '06:00', end: '14:00' },
        afternoon: { start: '14:00', end: '22:00' },
        night:     { start: '22:00', end: '06:00' },
      };
      const times = SHIFT_TIMES[shift_type] || { start: '08:00', end: '16:00' };

      const ref = await db.collection('shifts').add({
        employee_uid:   employee_id,
        employee_id:    empSnap.exists ? empSnap.data().employee_id : null,
        employee_name:  empSnap.exists ? empSnap.data().name : null,
        site_id,
        site_name:      siteSnap.exists ? siteSnap.data().name : null,
        date,
        shift_type,
        start_time:     times.start,
        end_time:       times.end,
        created_at:     new Date(),
      });

      const newDoc = await ref.get();
      const d = newDoc.data();
      return res.status(201).json({ id: ref.id, ...d });
    } catch (err) {
      console.error('admin/schedule POST error:', err);
      return res.status(500).json({ message: 'Failed to create shift.' });
    }
  });

  // ── DELETE /schedule/:id ─────────────────────────────────────────────────
  router.delete('/schedule/:id', ...guard, async (req, res) => {
    try {
      await db.collection('shifts').doc(req.params.id).delete();
      return res.json({ success: true });
    } catch (err) {
      console.error('admin/schedule DELETE error:', err);
      return res.status(500).json({ message: 'Failed to delete shift.' });
    }
  });

  // ── GET /clients ─────────────────────────────────────────────────────────
  router.get('/clients', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('clients').orderBy('name').get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          contact_name: d.contact_name,
          contact_email: d.contact_email,
          contact_phone: d.contact_phone,
          sites_count: d.sites_count || 0,
          contract_start: d.contract_start,
          sla_response_hours: d.sla_response_hours || 4,
          status: d.status,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/clients error:', err);
      return res.status(500).json({ message: 'Failed to fetch clients.' });
    }
  });

  // ── GET /clients/:id ─────────────────────────────────────────────────────
  router.get('/clients/:id', ...guard, async (req, res) => {
    try {
      const [clientSnap, sitesSnap, ticketsSnap] = await Promise.all([
        db.collection('clients').doc(req.params.id).get(),
        db.collection('sites').where('client_uid', '==', req.params.id).get(),
        db.collection('complaints').where('client_uid', '==', req.params.id).where('status', 'in', ['open', 'in_progress']).get(),
      ]);

      if (!clientSnap.exists) return res.status(404).json({ message: 'Client not found.' });

      const d = clientSnap.data();
      const sites = sitesSnap.docs.map(s => ({
        id: s.id,
        name: s.data().name,
        address: s.data().address,
        guards_deployed: s.data().guards_deployed || 0,
      }));

      return res.json({
        id: clientSnap.id,
        name: d.name,
        contact_name: d.contact_name,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone,
        sites_count: sites.length,
        contract_start: d.contract_start,
        sla_response_hours: d.sla_response_hours || 4,
        status: d.status,
        sites,
        open_tickets: ticketsSnap.size,
        notes: d.notes || null,
      });
    } catch (err) {
      console.error('admin/clients/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch client.' });
    }
  });

  // ── GET /sites ────────────────────────────────────────────────────────────
  router.get('/sites', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('sites').orderBy('name').get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          client_id: d.client_uid,
          client_name: d.client_name,
          address: d.address,
          posts_required: d.posts_required || 0,
          guards_deployed: d.guards_deployed || 0,
          coverage_status: d.coverage_status || 'none',
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/sites error:', err);
      return res.status(500).json({ message: 'Failed to fetch sites.' });
    }
  });

  // ── GET /sites/:id ────────────────────────────────────────────────────────
  router.get('/sites/:id', ...guard, async (req, res) => {
    try {
      const [siteSnap, guardsSnap] = await Promise.all([
        db.collection('sites').doc(req.params.id).get(),
        db.collection('employees').where('site_ids', 'array-contains', req.params.id).where('status', '==', 'active').get(),
      ]);

      if (!siteSnap.exists) return res.status(404).json({ message: 'Site not found.' });

      const d = siteSnap.data();
      const today = todayStr();
      // Find which guards are on today's shift at this site
      const todayShifts = await db.collection('shifts')
        .where('site_id', '==', req.params.id)
        .where('date', '==', today)
        .get();

      const activeGuards = todayShifts.docs.map(s => ({
        id: s.data().employee_uid,
        name: s.data().employee_name,
        shift_type: s.data().shift_type,
      }));

      return res.json({
        id: siteSnap.id,
        name: d.name,
        client_id: d.client_uid,
        client_name: d.client_name,
        address: d.address,
        posts_required: d.posts_required || 0,
        guards_deployed: d.guards_deployed || 0,
        coverage_status: d.coverage_status || 'none',
        site_contact_name: d.site_contact_name || null,
        site_contact_phone: d.site_contact_phone || null,
        notes: d.notes || null,
        active_guards: activeGuards,
      });
    } catch (err) {
      console.error('admin/sites/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch site.' });
    }
  });

  // ── GET /payroll ─────────────────────────────────────────────────────────
  router.get('/payroll', ...guard, async (req, res) => {
    const month = req.query.month || currentMonth();
    try {
      const snap = await db.collection('payslips')
        .where('period', '==', month)
        .get();

      let totalPayable = 0, totalDeductions = 0;

      const employees = snap.docs.map(doc => {
        const d = doc.data();
        totalPayable    += d.net_pay    || 0;
        totalDeductions += d.deductions || 0;
        return {
          id: doc.id,
          employee_id: d.employee_id,
          name: d.employee_name,
          days_in_month: d.days_in_month || null,
          days_worked: d.days_worked || null,
          leaves_taken: d.leaves_taken || null,
          gross_pay: d.gross_pay || 0,
          deductions: d.deductions || 0,
          net_pay: d.net_pay || 0,
          slip_status: 'generated',
          slip_url: d.pdf_url || null,
        };
      });

      return res.json({
        summary: {
          total_payable: totalPayable,
          slips_generated: snap.size,
          pending: 0,           // TODO: compute from active employees without a slip this month
          total_deductions: totalDeductions,
        },
        employees,
      });
    } catch (err) {
      console.error('admin/payroll error:', err);
      return res.status(500).json({ message: 'Failed to fetch payroll.' });
    }
  });

  // ── POST /payroll/run ────────────────────────────────────────────────────
  router.post('/payroll/run', ...guard, async (req, res) => {
    const { month } = req.body || {};
    if (!month) return res.status(400).json({ message: 'month is required (YYYY-MM).' });

    try {
      const empSnap = await db.collection('employees').where('status', '==', 'active').get();
      const batch = db.batch();

      for (const empDoc of empSnap.docs) {
        const emp = empDoc.data();
        // Basic payslip computation — replace with real payroll logic
        const grossPay  = emp.basic_salary || 15000;
        const deductions = Math.round(grossPay * 0.02);   // Placeholder 2% deduction
        const netPay    = grossPay - deductions;

        const slipRef = db.collection('payslips').doc();
        batch.set(slipRef, {
          employee_uid: empDoc.id,
          employee_id: emp.employee_id,
          employee_name: emp.name,
          period: month,
          gross_pay: grossPay,
          deductions,
          net_pay: netPay,
          basic: emp.basic_salary || 13000,
          allowances: Math.round(grossPay * 0.13),
          generated_at: new Date(),
          pdf_url: null,          // PDF generation via Cloud Storage — TODO
        });
      }

      await batch.commit();
      await logActivity(db, 'other', `Payroll run for ${month}: ${empSnap.size} slips generated`, 'admin');

      return res.json({ success: true, generated: empSnap.size });
    } catch (err) {
      console.error('payroll/run error:', err);
      return res.status(500).json({ message: 'Failed to run payroll.' });
    }
  });

  // ── POST /payroll/:employee_id/generate-slip ─────────────────────────────
  router.post('/payroll/:employee_id/generate-slip', ...guard, async (req, res) => {
    const { month } = req.body || {};
    if (!month) return res.status(400).json({ message: 'month is required.' });

    try {
      // TODO: Generate PDF and upload to Cloud Storage
      const empSnap = await db.collection('employees').doc(req.params.employee_id).get();
      if (!empSnap.exists) return res.status(404).json({ message: 'Employee not found.' });

      const emp = empSnap.data();
      const slipUrl = null; // Set after PDF generation

      return res.json({ slip_url: slipUrl });
    } catch (err) {
      console.error('payroll/generate-slip error:', err);
      return res.status(500).json({ message: 'Failed to generate payslip.' });
    }
  });

  // ── GET /complaints ───────────────────────────────────────────────────────
  router.get('/complaints', ...guard, async (req, res) => {
    const { status, priority, site, search } = req.query;
    try {
      let query = db.collection('complaints').orderBy('created_at', 'desc');
      if (status) query = query.where('status', '==', status);
      if (priority) query = query.where('priority', '==', priority);

      const snap = await query.limit(100).get();

      let items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ticket_id: d.ticket_id,
          client_name: d.client_name,
          site: d.site_name || null,
          subject: d.subject,
          priority: d.priority,
          status: d.status,
          submitted_at: d.created_at ? d.created_at.toDate().toISOString() : null,
          message: d.description,
          admin_note: d.admin_note || null,
        };
      });

      // Apply site and search filters in memory (Firestore doesn't support multi-field LIKE)
      if (site) items = items.filter(i => i.site === site);
      if (search) {
        const s = search.toLowerCase();
        items = items.filter(i =>
          i.subject.toLowerCase().includes(s) ||
          (i.client_name || '').toLowerCase().includes(s) ||
          (i.ticket_id || '').toLowerCase().includes(s)
        );
      }

      return res.json(items);
    } catch (err) {
      console.error('admin/complaints error:', err);
      return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
  });

  // ── GET /complaints/:id ───────────────────────────────────────────────────
  router.get('/complaints/:id', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('complaints').doc(req.params.id).get();
      if (!snap.exists) return res.status(404).json({ message: 'Complaint not found.' });
      const d = snap.data();
      return res.json({
        id: snap.id,
        ticket_id: d.ticket_id,
        client_name: d.client_name,
        site: d.site_name || null,
        subject: d.subject,
        priority: d.priority,
        status: d.status,
        submitted_at: d.created_at ? d.created_at.toDate().toISOString() : null,
        message: d.description,
        admin_note: d.admin_note || null,
      });
    } catch (err) {
      console.error('admin/complaints/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch complaint.' });
    }
  });

  // ── POST /complaints/:id/status ───────────────────────────────────────────
  router.post('/complaints/:id/status', ...guard, async (req, res) => {
    const { status, note } = req.body || {};
    if (!status) return res.status(400).json({ message: 'status is required.' });
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'status must be open, in_progress, or resolved.' });
    }

    try {
      const ref  = db.collection('complaints').doc(req.params.id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: 'Complaint not found.' });

      await ref.update({ status, admin_note: note || null, updated_at: new Date() });

      // TODO: Notify client via push/email
      await logActivity(db, 'complaint', `Complaint ${snap.data().ticket_id} status → ${status}`, 'admin');

      return res.json({ success: true });
    } catch (err) {
      console.error('admin/complaints/:id/status error:', err);
      return res.status(500).json({ message: 'Failed to update complaint status.' });
    }
  });

  // ── GET /reports ──────────────────────────────────────────────────────────
  router.get('/reports', ...guard, async (req, res) => {
    const { period = 'this_month' } = req.query;
    const { from, to } = periodToDateRange(period);

    try {
      const [attendanceSnap, incidentsSnap, complaintsSnap, empSnap] = await Promise.all([
        db.collection('attendance_logs').where('date', '>=', from).where('date', '<=', to).get(),
        db.collection('incidents').where('submitted_at', '>=', new Date(from)).where('submitted_at', '<=', new Date(to + 'T23:59:59')).get(),
        db.collection('complaints').where('created_at', '>=', new Date(from)).get(),
        db.collection('employees').where('status', '==', 'active').get(),
      ]);

      // Attendance rate per site
      const siteAttendance = {};
      attendanceSnap.docs.forEach(doc => {
        const d = doc.data();
        const site = d.site_name || 'Unknown';
        if (!siteAttendance[site]) siteAttendance[site] = { total: 0, present: 0 };
        siteAttendance[site].total++;
        if (d.check_in) siteAttendance[site].present++;
      });

      const attendanceBySite = Object.entries(siteAttendance).map(([site_name, v]) => ({
        site_name,
        rate: v.total > 0 ? Math.round((v.present / v.total) * 1000) / 10 : 0,
      }));

      const avgAttendance = attendanceBySite.length > 0
        ? Math.round(attendanceBySite.reduce((a, b) => a + b.rate, 0) / attendanceBySite.length * 10) / 10
        : 0;

      // Incidents by type
      const incidentTypes = {};
      incidentsSnap.docs.forEach(doc => {
        const t = doc.data().type || 'other';
        incidentTypes[t] = (incidentTypes[t] || 0) + 1;
      });
      const TYPE_LABELS = {
        trespassing: 'Trespassing',
        suspicious_activity: 'Suspicious Activity',
        theft: 'Theft',
        fire: 'Fire / Hazard',
        equipment_failure: 'Equipment Failure',
        medical: 'Medical Emergency',
        other: 'Other',
      };
      const incidentsByType = Object.entries(incidentTypes).map(([t, count]) => ({
        type_label: TYPE_LABELS[t] || t,
        count,
      }));

      // SLA compliance (using 4-hour default SLA)
      const slaHours = 4;
      let within = 0, breached = 0;
      complaintsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.status === 'resolved' && d.created_at && d.updated_at) {
          const hrs = (d.updated_at.toDate() - d.created_at.toDate()) / 3600000;
          if (hrs <= slaHours) within++; else breached++;
        }
      });
      const total = within + breached;

      // Leave utilisation
      const leaveSnap = await db.collection('leave_requests')
        .where('status', '==', 'approved')
        .where('applied_at', '>=', new Date(from))
        .get();
      const leaveByType = { casual: 0, sick: 0, earned: 0 };
      leaveSnap.docs.forEach(doc => {
        const t = doc.data().leave_type;
        if (leaveByType[t] != null) leaveByType[t]++;
      });
      const empCount = empSnap.size;
      const LEAVE_ALLOCS = { casual: 6, sick: 4, earned: 2 };
      const leaveUtilisation = Object.entries(leaveByType).map(([type, days_taken]) => ({
        leave_type_label: { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave' }[type],
        days_taken,
        days_available: (LEAVE_ALLOCS[type] || 0) * empCount,
      }));

      return res.json({
        overview: {
          avg_attendance_rate: avgAttendance,
          incidents_reported: incidentsSnap.size,
          tickets_resolved: complaintsSnap.docs.filter(d => d.data().status === 'resolved').length,
          avg_resolution_hours: total > 0 ? slaHours : null,  // simplified
        },
        attendance_by_site: attendanceBySite,
        sla_compliance: {
          within_sla: within,
          breached,
          rate: total > 0 ? Math.round((within / total) * 1000) / 10 : 100,
        },
        incidents_by_type: incidentsByType,
        leave_utilisation: leaveUtilisation,
        guard_performance: [],  // TODO: compute per-guard metrics
      });
    } catch (err) {
      console.error('admin/reports error:', err);
      return res.status(500).json({ message: 'Failed to fetch reports.' });
    }
  });

  return { router };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function periodToDateRange(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case 'last_month': {
      const d = new Date(y, m - 1, 1);
      return { from: fmtDate(d), to: fmtDate(new Date(y, m, 0)) };
    }
    case 'last_3_months':
      return { from: fmtDate(new Date(y, m - 2, 1)), to: fmtDate(now) };
    case 'last_6_months':
      return { from: fmtDate(new Date(y, m - 5, 1)), to: fmtDate(now) };
    case 'this_year':
      return { from: `${y}-01-01`, to: fmtDate(now) };
    case 'this_month':
    default:
      return { from: fmtDate(new Date(y, m, 1)), to: fmtDate(now) };
  }
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function setLeaveStatus(db, id, status, res) {
  try {
    const ref  = db.collection('leave_requests').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Leave request not found.' });

    await ref.update({ status, reviewed_at: new Date() });
    // TODO: Notify employee via push/SMS
    return res.json({ success: true });
  } catch (err) {
    console.error(`leave ${status} error:`, err);
    return res.status(500).json({ message: `Failed to ${status} leave.` });
  }
}

async function setEmployeeStatus(db, auth, id, status, res) {
  try {
    await db.collection('employees').doc(id).update({ status, updated_at: new Date() });
    // Disable/enable Firebase Auth account to match
    await auth.updateUser(id, { disabled: status === 'inactive' });
    await logActivity(db, 'other', `Employee ${id} ${status === 'inactive' ? 'deactivated' : 'reactivated'}`, 'admin');
    return res.json({ success: true });
  } catch (err) {
    console.error(`employee ${status} error:`, err);
    return res.status(500).json({ message: `Failed to update employee status.` });
  }
}

async function nextEmployeeId(db) {
  const snap = await db.collection('employees').orderBy('employee_id', 'desc').limit(1).get();
  if (snap.empty) return 'VAGT-0001';
  const last = snap.docs[0].data().employee_id || 'VAGT-0000';
  const num  = parseInt(last.replace('VAGT-', ''), 10) + 1;
  return `VAGT-${String(num).padStart(4, '0')}`;
}

async function logActivity(db, type, description, actor) {
  try {
    await db.collection('activity_log').add({ type, description, actor, time: new Date() });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
