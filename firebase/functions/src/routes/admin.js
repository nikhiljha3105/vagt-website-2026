/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VAGT Security Services — Admin Portal Routes
 * File: firebase/functions/src/routes/admin.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ALL ROUTES REQUIRE: Firebase ID token with role === 'admin'
 * If you get 403 errors, the logged-in user doesn't have the admin role claim.
 * Fix: admin.auth().setCustomUserClaims(uid, { role: 'admin' })
 *
 * ENDPOINTS:
 *   GET  /api/admin/overview                              — dashboard numbers
 *   GET  /api/admin/activity                              — recent activity log
 *   GET  /api/admin/pending-registrations                 — guards awaiting approval
 *   POST /api/admin/registrations/:id/approve             — approve a guard
 *   POST /api/admin/registrations/:id/reject              — reject a guard
 *   GET  /api/admin/pending-leaves                        — leaves waiting for decision
 *   POST /api/admin/leaves/:id/approve                    — approve leave
 *   POST /api/admin/leaves/:id/reject                     — reject leave
 *   GET  /api/admin/employees                             — list all employees
 *   GET  /api/admin/employees/:id                         — single employee detail
 *   POST /api/admin/employees/:id/deactivate              — suspend employee
 *   POST /api/admin/employees/:id/reactivate              — reinstate employee
 *   POST /api/admin/employees/:id/generate-keycode        — issue physical keycode
 *   POST /api/admin/employees/:id/revoke-keycode          — revoke keycode
 *   GET  /api/admin/sign-in-events                        — keycode sign-in audit log
 *   GET  /api/admin/schedule                              — view shift schedule
 *   POST /api/admin/schedule                              — create a shift
 *   DELETE /api/admin/schedule/:id                        — remove a shift
 *   GET  /api/admin/clients                               — list all clients
 *   GET  /api/admin/clients/:id                           — single client detail
 *   GET  /api/admin/sites                                 — list all sites
 *   GET  /api/admin/sites/:id                             — single site detail
 *   GET  /api/admin/payroll                               — view payroll for a month
 *   POST /api/admin/payroll/run                           — generate all payslips for a month
 *   POST /api/admin/payroll/:employee_id/generate-slip    — regenerate one payslip
 *   GET  /api/admin/complaints                            — list all complaints
 *   GET  /api/admin/complaints/:id                        — single complaint detail
 *   POST /api/admin/complaints/:id/status                 — update complaint status
 *   GET  /api/admin/reports                               — analytics / reports
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EMPLOYEE APPROVAL FLOW:
 *   Guard registers on app → OTP verified → pending_registration created
 *   Admin sees it in GET /pending-registrations
 *   Admin clicks Approve → POST /registrations/:id/approve
 *     → Firebase Auth account ENABLED
 *     → employee doc created in Firestore with next VAGT-XXXX ID
 *     → TODO: password reset link sent via SMS (currently commented out)
 *   Admin clicks Reject → POST /registrations/:id/reject
 *     → disabled Firebase Auth account deleted (cleanup)
 *     → pending_registration marked rejected
 *
 * PAYROLL NOTES:
 *   ⚠️  The payroll computation (gross pay, deductions, net pay) is currently
 *   a PLACEHOLDER using basic_salary from the employee doc with a flat 2%
 *   deduction. This is NOT production-ready.
 *   BEFORE GO-LIVE: Replace the computation block in POST /payroll/run with:
 *     - Real basic + HRA + allowances from the employee doc
 *     - EPF (12% employee + 12% employer on basic, capped at ₹15,000 basic)
 *     - ESI (0.75% employee + 3.25% employer on gross, if gross ≤ ₹21,000)
 *     - TDS if applicable
 *     - Days-present based proration from attendance_logs
 *   The structure is already there — just replace the numbers.
 *
 * KEYCODE SYSTEM:
 *   Keycodes are format XXXX-XXXX using only unambiguous characters
 *   (no 0, O, I, 1 to avoid confusion on printed cards).
 *   Each guard can have only one active keycode at a time.
 *   Generating a new keycode auto-revokes the old one.
 *
 * DEBUG TIPS:
 *   - "Registration not found" → the pending_registration ID is wrong or was deleted
 *   - "Registration phone not yet verified" → guard never completed step 2 (OTP verify)
 *   - "Employee already has a shift on this date" → check shifts collection in Firestore
 *   - Payroll numbers are wrong → check basic_salary field on the employee doc
 *   - Reports show 0% attendance → check attendance_logs has check_in field set
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');

module.exports = function ({ db, auth, requireAuth, requireAdmin }) {
  const router = express.Router();
  const guard  = [requireAuth, requireAdmin]; // shorthand — applied to every route below

  // ── GET /overview ─────────────────────────────────────────────────────────
  // Returns the 4 summary numbers shown on the admin dashboard:
  // active employees, attendance today, open tickets, pending leaves.
  // All 5 Firestore queries run in parallel (Promise.all) — single round trip.
  router.get('/overview', ...guard, async (req, res) => {
    try {
      const [empSnap, pendingRegSnap, openTicketsSnap, pendingLeavesSnap, attendanceSnap] = await Promise.all([
        db.collection('employees').limit(500).get(),
        db.collection('pending_registrations').where('verified', '==', true).get(),
        db.collection('complaints').where('status', 'in', ['open', 'in_progress']).get(),
        db.collection('leave_requests').where('status', '==', 'pending').get(),
        db.collection('attendance_logs').where('date', '==', todayStr()).get(),
      ]);

      const employees      = empSnap.docs.map(d => d.data());
      const active         = employees.filter(e => e.status === 'active').length;
      const pending        = employees.filter(e => e.status === 'pending').length;
      const checkedIn      = attendanceSnap.docs.filter(d => d.data().check_in && !d.data().check_out).length;
      const onDuty         = attendanceSnap.size;
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

  // ── GET /activity ─────────────────────────────────────────────────────────
  // Returns the 50 most recent entries from the activity_log collection.
  // Everything significant (check-ins, leaves, approvals, incidents) is logged there.
  // NOTE: activity_log has no TTL — it will grow forever. Add a cleanup strategy
  // before going to production (Firebase Scheduled Functions can delete old entries).
  router.get('/activity', ...guard, async (req, res) => {
    try {
      const snap  = await db.collection('activity_log').orderBy('time', 'desc').limit(50).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          type:        d.type,
          description: d.description,
          time:        d.time ? d.time.toDate().toISOString() : null,
          actor:       d.actor,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/activity error:', err);
      return res.status(500).json({ message: 'Failed to fetch activity.' });
    }
  });

  // ── GET /pending-registrations ────────────────────────────────────────────
  // Returns guards who have verified their OTP but haven't been approved yet.
  // These are the cards the admin sees in the "New Registrations" section.
  router.get('/pending-registrations', ...guard, async (req, res) => {
    try {
      // Return all verified registrations (pending + approved + rejected)
      // so the admin UI can show all tabs. Ordered newest first.
      const snap = await db.collection('pending_registrations')
        .where('verified', '==', true)
        .orderBy('verified_at', 'desc')
        .get();

      const registrations = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:          doc.id,
          name:        d.name        || null,
          phone:       d.phone       || null,
          email:       d.email       || null,
          approved:    d.approved    || false,
          rejected:    d.rejected    || false,
          approved_at: d.approved_at || null,
          rejected_at: d.rejected_at || null,
          created_at:  d.created_at  || null,
          verified_at: d.verified_at || null,
        };
      });

      return res.json({ registrations });
    } catch (err) {
      console.error('pending-registrations error:', err);
      return res.status(500).json({ message: 'Failed to fetch registrations.' });
    }
  });

  // ── POST /registrations/:id/approve ──────────────────────────────────────
  // Admin approves a guard registration. This does 3 things atomically:
  //   1. Enables the disabled Firebase Auth account
  //   2. Creates the employee Firestore document with auto-assigned VAGT-XXXX ID
  //   3. Sets the 'employee' role claim on the Auth account
  // After this, the guard can log in.
  router.post('/registrations/:id/approve', ...guard, async (req, res) => {
    const { id } = req.params;
    try {
      const regRef  = db.collection('pending_registrations').doc(id);
      const regSnap = await regRef.get();
      if (!regSnap.exists)         return res.status(404).json({ message: 'Registration not found.' });

      const reg = regSnap.data();
      if (reg.approved)            return res.status(409).json({ message: 'Already approved.' });
      if (!reg.firebase_uid)       return res.status(400).json({ message: 'Registration phone not yet verified.' });

      // Enable the Firebase Auth account (was disabled at verify-otp time)
      await auth.updateUser(reg.firebase_uid, {
        disabled:    false,
        displayName: reg.name || reg.phone,
      });

      // Grant the employee role (used by backend middleware + Firestore rules)
      await auth.setCustomUserClaims(reg.firebase_uid, { role: 'employee' });

      // Create employee Firestore document with starting leave balance
      const empId = await nextEmployeeId(db);
      await db.collection('employees').doc(reg.firebase_uid).set({
        name:          reg.name || reg.phone,
        phone:         reg.phone,
        email:         reg.email,
        employee_id:   empId,
        status:        'active',
        leave_balance: { casual: 6, sick: 4, earned: 2 }, // Starting allocation — adjust as needed
        site_ids:      [],   // No site assigned yet — admin assigns via the employees page
        joined_at:     new Date(),
      });

      await regRef.update({ approved: true, approved_at: new Date() });
      await logActivity(db, 'registration', `Employee ${empId} (${reg.phone}) approved`, 'admin', req.user.uid);

      // ── Send password reset email via Firebase ─────────────────────────
      // Firebase's Identity Toolkit sends a password-reset email using the
      // template configured in Firebase Console → Authentication → Templates.
      // This is free, requires no third-party service, and the guard will
      // receive a link to set their own password before first login.
      // When SMS (MSG91) is ready, add a parallel sendSms() call here.
      try {
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_API_KEY || 'AIzaSyB8jOeTk3u6QkXz190qb3Q-I8RiWVuPXv4'}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ requestType: 'PASSWORD_RESET', email: reg.email }),
          }
        );
      } catch (emailErr) {
        // Non-fatal — account is approved regardless. Log and continue.
        console.warn('approval email failed (non-fatal):', emailErr.message);
      }
      // ──────────────────────────────────────────────────────────────────

      return res.json({ success: true, employee_id: empId });
    } catch (err) {
      console.error('registrations/approve error:', err);
      return res.status(500).json({ message: 'Failed to approve registration.' });
    }
  });

  // ── POST /registrations/:id/reject ───────────────────────────────────────
  // Admin rejects a guard. Deletes the disabled Firebase Auth account to keep
  // Auth clean (otherwise ghost accounts accumulate indefinitely).
  router.post('/registrations/:id/reject', ...guard, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    try {
      const regRef = db.collection('pending_registrations').doc(id);
      const snap   = await regRef.get();
      if (!snap.exists) return res.status(404).json({ message: 'Registration not found.' });

      const reg = snap.data();

      // Clean up the disabled Auth account created at verify-otp time
      if (reg.firebase_uid) {
        try {
          await auth.deleteUser(reg.firebase_uid);
        } catch (deleteErr) {
          // Log but don't fail — the account might already be gone
          console.warn(`Could not delete Auth account ${reg.firebase_uid}:`, deleteErr.message);
        }
      }

      await regRef.update({ rejected: true, reject_reason: reason || null, rejected_at: new Date() });
      await logActivity(db, 'registration', `Registration for ${reg.phone} rejected`, 'admin', req.user.uid);

      return res.json({ success: true });
    } catch (err) {
      console.error('registrations/reject error:', err);
      return res.status(500).json({ message: 'Failed to reject registration.' });
    }
  });

  // ── GET /pending-leaves ───────────────────────────────────────────────────
  // Returns all leave requests with status 'pending'.
  // Uses db.getAll() to batch-fetch all related employee docs in ONE Firestore call
  // instead of one call per leave (avoids N+1 query — critical at scale).
  router.get('/pending-leaves', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('leave_requests')
        .where('status', '==', 'pending')
        .orderBy('applied_at', 'asc') // oldest first — FIFO processing
        .get();

      const LABELS = { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave' };

      // Batch fetch: one network round trip for ALL employee docs at once
      // This is important — without it, 50 pending leaves = 50 separate DB calls
      const empRefs = snap.docs.map(doc => db.collection('employees').doc(doc.data().employee_uid));
      const empDocs = empRefs.length > 0 ? await db.getAll(...empRefs) : [];
      const empMap  = {};
      empDocs.forEach(d => { if (d.exists) empMap[d.id] = d.data(); });

      const items = snap.docs.map(doc => {
        const d   = doc.data();
        const emp = empMap[d.employee_uid] || {};
        return {
          id:               doc.id,
          employee_id:      emp.employee_id       || null,
          employee_name:    emp.name              || d.employee_uid,
          leave_type:       d.leave_type,
          leave_type_label: LABELS[d.leave_type]  || d.leave_type,
          from_date:        d.from_date,
          to_date:          d.to_date,
          reason:           d.reason,
          applied_at:       d.applied_at ? d.applied_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('admin/pending-leaves error:', err);
      return res.status(500).json({ message: 'Failed to fetch pending leaves.' });
    }
  });

  // ── POST /leaves/:id/approve  &  POST /leaves/:id/reject ─────────────────
  // Both routes delegate to setLeaveStatus() helper at the bottom of this file.
  // TODO: When SMS is integrated, notify the employee here.
  router.post('/leaves/:id/approve', ...guard, async (req, res) => {
    await setLeaveStatus(db, req.params.id, 'approved', res);
  });
  router.post('/leaves/:id/reject', ...guard, async (req, res) => {
    await setLeaveStatus(db, req.params.id, 'rejected', res);
  });

  // ── GET /employees ────────────────────────────────────────────────────────
  // List all employees. Optional ?status=active|inactive filter.
  // Capped at 500 — if you have more, add pagination with startAfter().
  router.get('/employees', ...guard, async (req, res) => {
    const { status } = req.query;
    try {
      let query = db.collection('employees').orderBy('name').limit(500);
      if (status) query = query.where('status', '==', status);

      const snap  = await query.get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:          doc.id,
          employee_id: d.employee_id,
          name:        d.name,
          phone:       d.phone,
          email:       d.email      || null,
          site_name:   d.site_name  || null,
          status:      d.status,
          joined_at:   d.joined_at ? d.joined_at.toDate().toISOString() : null,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/employees error:', err);
      return res.status(500).json({ message: 'Failed to fetch employees.' });
    }
  });

  // ── GET /employees/:id ────────────────────────────────────────────────────
  // Full employee detail — includes leave balance, emergency contact, Aadhaar last 4.
  router.get('/employees/:id', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('employees').doc(req.params.id).get();
      if (!snap.exists) return res.status(404).json({ message: 'Employee not found.' });
      const d = snap.data();
      return res.json({
        id:                snap.id,
        employee_id:       d.employee_id,
        name:              d.name,
        phone:             d.phone,
        email:             d.email              || null,
        site_name:         d.site_name          || null,
        status:            d.status,
        joined_at:         d.joined_at ? d.joined_at.toDate().toISOString() : null,
        aadhaar_last4:     d.aadhaar_last4       || null,
        address:           d.address             || null,
        emergency_contact: d.emergency_contact   || null,
        leave_balance:     d.leave_balance        || {},
        attendance_rate:   d.attendance_rate      || null,
      });
    } catch (err) {
      console.error('admin/employees/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch employee.' });
    }
  });

  // ── POST /employees/:id/deactivate  &  POST /employees/:id/reactivate ────
  // Deactivating an employee also disables their Firebase Auth account so they
  // can't log in. Reactivating re-enables both Firestore status and Auth account.
  router.post('/employees/:id/deactivate', ...guard, async (req, res) => {
    await setEmployeeStatus(db, auth, req.params.id, 'inactive', res, req.user.uid);
  });
  router.post('/employees/:id/reactivate', ...guard, async (req, res) => {
    await setEmployeeStatus(db, auth, req.params.id, 'active', res, req.user.uid);
  });

  // ── GET /schedule  &  POST /schedule  &  DELETE /schedule/:id ────────────
  // Schedule management — admins create/view/delete shifts.
  // A shift is: one employee + one site + one date + shift type (morning/afternoon/night)
  // Shift times are auto-set from the SHIFT_TIMES map — change times there if needed.

  router.get('/schedule', ...guard, async (req, res) => {
    const { week_start } = req.query;
    try {
      let query = db.collection('shifts').orderBy('date');
      if (week_start) {
        // Return only the 7 days starting from week_start
        const end = new Date(week_start);
        end.setDate(end.getDate() + 7);
        query = query.where('date', '>=', week_start).where('date', '<', end.toISOString().slice(0, 10));
      } else {
        query = query.where('date', '>=', todayStr()).limit(100); // Default: next 100 upcoming shifts
      }

      const snap  = await query.get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:            doc.id,
          employee_id:   d.employee_id,
          employee_name: d.employee_name,
          site_id:       d.site_id,
          site_name:     d.site_name,
          date:          d.date,
          shift_type:    d.shift_type,
          start_time:    d.start_time,
          end_time:      d.end_time,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/schedule GET error:', err);
      return res.status(500).json({ message: 'Failed to fetch schedule.' });
    }
  });

  router.post('/schedule', ...guard, async (req, res) => {
    const { employee_id, site_id, date, shift_type } = req.body || {};
    if (!employee_id || !site_id || !date || !shift_type) {
      return res.status(400).json({ message: 'employee_id, site_id, date, and shift_type are required.' });
    }

    try {
      // Prevent double-booking — one employee, one shift per day
      const existing = await db.collection('shifts')
        .where('employee_uid', '==', employee_id)
        .where('date', '==', date)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'Employee already has a shift on this date.' });
      }

      // Fetch names for denormalization — stored on the shift doc so the schedule
      // page doesn't need extra lookups to display employee and site names
      const [empSnap, siteSnap] = await Promise.all([
        db.collection('employees').doc(employee_id).get(),
        db.collection('sites').doc(site_id).get(),
      ]);

      // Default shift times — adjust these if VAGT uses different timings
      const SHIFT_TIMES = {
        morning:   { start: '06:00', end: '14:00' },
        afternoon: { start: '14:00', end: '22:00' },
        night:     { start: '22:00', end: '06:00' }, // night shift crosses midnight
      };
      const times = SHIFT_TIMES[shift_type] || { start: '08:00', end: '16:00' };

      const ref = await db.collection('shifts').add({
        employee_uid:  employee_id,
        employee_id:   empSnap.exists ? empSnap.data().employee_id : null,
        employee_name: empSnap.exists ? empSnap.data().name : null,
        site_id,
        site_name:     siteSnap.exists ? siteSnap.data().name : null,
        date,
        shift_type,
        start_time:    times.start,
        end_time:      times.end,
        created_at:    new Date(),
      });

      const newDoc = await ref.get();
      return res.status(201).json({ id: ref.id, ...newDoc.data() });
    } catch (err) {
      console.error('admin/schedule POST error:', err);
      return res.status(500).json({ message: 'Failed to create shift.' });
    }
  });

  router.delete('/schedule/:id', ...guard, async (req, res) => {
    try {
      await db.collection('shifts').doc(req.params.id).delete();
      return res.json({ success: true });
    } catch (err) {
      console.error('admin/schedule DELETE error:', err);
      return res.status(500).json({ message: 'Failed to delete shift.' });
    }
  });

  // ── GET /clients  &  GET /clients/:id ────────────────────────────────────
  // Client management. capped at 500. Each client has a sites[] and open_tickets count.

  router.get('/clients', ...guard, async (req, res) => {
    try {
      const snap  = await db.collection('clients').orderBy('name').limit(500).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:                   doc.id,
          name:                 d.name,
          contact_name:         d.contact_name,
          contact_email:        d.contact_email,
          contact_phone:        d.contact_phone,
          sites_count:          d.sites_count          || 0,
          contract_start:       d.contract_start,
          sla_response_hours:   d.sla_response_hours   || 4, // default 4-hour SLA
          status:               d.status,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/clients error:', err);
      return res.status(500).json({ message: 'Failed to fetch clients.' });
    }
  });

  router.get('/clients/:id', ...guard, async (req, res) => {
    try {
      // 3 parallel reads: client doc + their sites + their open tickets
      const [clientSnap, sitesSnap, ticketsSnap] = await Promise.all([
        db.collection('clients').doc(req.params.id).get(),
        db.collection('sites').where('client_uid', '==', req.params.id).get(),
        db.collection('complaints').where('client_uid', '==', req.params.id).where('status', 'in', ['open', 'in_progress']).get(),
      ]);

      if (!clientSnap.exists) return res.status(404).json({ message: 'Client not found.' });

      const d     = clientSnap.data();
      const sites = sitesSnap.docs.map(s => ({
        id:              s.id,
        name:            s.data().name,
        address:         s.data().address,
        guards_deployed: s.data().guards_deployed || 0,
      }));

      return res.json({
        id:                   clientSnap.id,
        name:                 d.name,
        contact_name:         d.contact_name,
        contact_email:        d.contact_email,
        contact_phone:        d.contact_phone,
        sites_count:          sites.length,
        contract_start:       d.contract_start,
        sla_response_hours:   d.sla_response_hours || 4,
        status:               d.status,
        sites,
        open_tickets:         ticketsSnap.size,
        notes:                d.notes || null,
      });
    } catch (err) {
      console.error('admin/clients/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch client.' });
    }
  });

  // ── GET /sites  &  GET /sites/:id ─────────────────────────────────────────

  router.get('/sites', ...guard, async (req, res) => {
    try {
      const snap  = await db.collection('sites').orderBy('name').limit(500).get();
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:               doc.id,
          name:             d.name,
          client_id:        d.client_uid,
          client_name:      d.client_name,
          address:          d.address,
          posts_required:   d.posts_required   || 0,
          guards_deployed:  d.guards_deployed  || 0,
          coverage_status:  d.coverage_status  || 'none',
        };
      });
      return res.json(items);
    } catch (err) {
      console.error('admin/sites error:', err);
      return res.status(500).json({ message: 'Failed to fetch sites.' });
    }
  });

  router.get('/sites/:id', ...guard, async (req, res) => {
    try {
      const [siteSnap, guardsSnap] = await Promise.all([
        db.collection('sites').doc(req.params.id).get(),
        db.collection('employees').where('site_ids', 'array-contains', req.params.id).where('status', '==', 'active').get(),
      ]);

      if (!siteSnap.exists) return res.status(404).json({ message: 'Site not found.' });

      const d = siteSnap.data();

      // Find which guards are on shift at this site TODAY
      const todayShifts = await db.collection('shifts')
        .where('site_id', '==', req.params.id)
        .where('date', '==', todayStr())
        .get();

      const activeGuards = todayShifts.docs.map(s => ({
        id:         s.data().employee_uid,
        name:       s.data().employee_name,
        shift_type: s.data().shift_type,
      }));

      return res.json({
        id:                 siteSnap.id,
        name:               d.name,
        client_id:          d.client_uid,
        client_name:        d.client_name,
        address:            d.address,
        posts_required:     d.posts_required    || 0,
        guards_deployed:    d.guards_deployed   || 0,
        coverage_status:    d.coverage_status   || 'none',
        site_contact_name:  d.site_contact_name  || null,
        site_contact_phone: d.site_contact_phone || null,
        notes:              d.notes              || null,
        active_guards:      activeGuards,
      });
    } catch (err) {
      console.error('admin/sites/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch site.' });
    }
  });

  // ── GET /payroll ──────────────────────────────────────────────────────────
  // Returns payslips already generated for a given month (default: current month).
  // Use ?month=YYYY-MM to view a different month.
  router.get('/payroll', ...guard, async (req, res) => {
    const month = req.query.month || currentMonth();
    try {
      const snap = await db.collection('payslips').where('period', '==', month).get();

      let totalPayable = 0, totalDeductions = 0;

      const employees = snap.docs.map(doc => {
        const d = doc.data();
        totalPayable    += d.net_pay    || 0;
        totalDeductions += d.deductions || 0;
        return {
          id:            doc.id,
          employee_id:   d.employee_id,
          name:          d.employee_name,
          days_in_month: d.days_in_month || null,
          days_worked:   d.days_worked   || null,
          leaves_taken:  d.leaves_taken  || null,
          gross_pay:     d.gross_pay     || 0,
          deductions:    d.deductions    || 0,
          net_pay:       d.net_pay       || 0,
          slip_status:   'generated',
          slip_url:      d.pdf_url       || null,
        };
      });

      return res.json({
        summary: {
          total_payable:    totalPayable,
          slips_generated:  snap.size,
          pending:          0, // TODO: compute = active employees count minus slips_generated
          total_deductions: totalDeductions,
        },
        employees,
      });
    } catch (err) {
      console.error('admin/payroll error:', err);
      return res.status(500).json({ message: 'Failed to fetch payroll.' });
    }
  });

  // ── POST /payroll/run ─────────────────────────────────────────────────────
  // Generates payslips for ALL active employees for the given month.
  // Body: { "month": "2026-03" }
  //
  // ⚠️  IMPORTANT: The computation below is a PLACEHOLDER.
  // Before going live, replace the "basic payslip computation" block with real logic:
  //   - Read employee basic_salary, hra, allowances from their Firestore doc
  //   - Calculate EPF: 12% of basic (employee contribution), capped at ₹15,000 basic
  //   - Calculate ESI: 0.75% of gross (if gross ≤ ₹21,000/month)
  //   - Prorate for days worked using attendance_logs
  //
  // Firebase batch writes are capped at 499 per batch.
  // This code chunks the employees into groups of 499 to handle any team size safely.
  router.post('/payroll/run', ...guard, async (req, res) => {
    const { month } = req.body || {};
    if (!month) return res.status(400).json({ message: 'month is required (YYYY-MM).' });

    try {
      const empSnap = await db.collection('employees').where('status', '==', 'active').get();

      // ── Chunk into batches of 499 (Firebase hard limit is 500 writes per batch) ──
      const BATCH_SIZE = 499;
      const chunks = [];
      for (let i = 0; i < empSnap.docs.length; i += BATCH_SIZE) {
        chunks.push(empSnap.docs.slice(i, i + BATCH_SIZE));
      }

      for (const chunk of chunks) {
        const batch = db.batch();

        for (const empDoc of chunk) {
          const emp = empDoc.data();

          // ── PLACEHOLDER COMPUTATION — replace before go-live ──────────
          // This is intentionally simple so you can see the structure.
          // Real payroll: replace grossPay, deductions, netPay with actual calculations.
          const grossPay   = emp.basic_salary || 15000;          // fallback ₹15,000 if no salary set
          const deductions = Math.round(grossPay * 0.02);        // 2% placeholder deduction
          const netPay     = grossPay - deductions;
          // ─────────────────────────────────────────────────────────────

          const slipRef = db.collection('payslips').doc();
          batch.set(slipRef, {
            employee_uid:  empDoc.id,
            employee_id:   emp.employee_id,
            employee_name: emp.name,
            period:        month,
            gross_pay:     grossPay,
            deductions,
            net_pay:       netPay,
            basic:         emp.basic_salary || 13000,
            allowances:    Math.round(grossPay * 0.13),
            generated_at:  new Date(),
            pdf_url:       null, // TODO: generate PDF and store URL in Cloud Storage
          });
        }

        await batch.commit();
      }

      await logActivity(db, 'other', `Payroll run for ${month}: ${empSnap.size} slips generated`, 'admin', req.user.uid);
      return res.json({ success: true, generated: empSnap.size });
    } catch (err) {
      console.error('payroll/run error:', err);
      return res.status(500).json({ message: 'Failed to run payroll.' });
    }
  });

  // ── POST /payroll/:employee_id/generate-slip ──────────────────────────────
  // Regenerate a single employee's payslip PDF.
  // TODO: Generate a real PDF using a library (e.g. pdfkit) and upload to Cloud Storage.
  // The pdf_url on the payslip doc should then be updated to the Storage download URL.
  router.post('/payroll/:employee_id/generate-slip', ...guard, async (req, res) => {
    const { month } = req.body || {};
    if (!month) return res.status(400).json({ message: 'month is required.' });

    try {
      const empSnap = await db.collection('employees').doc(req.params.employee_id).get();
      if (!empSnap.exists) return res.status(404).json({ message: 'Employee not found.' });

      // TODO: Generate PDF, upload to Cloud Storage, return download URL
      const slipUrl = null; // Replace with actual URL after PDF generation

      return res.json({ slip_url: slipUrl });
    } catch (err) {
      console.error('payroll/generate-slip error:', err);
      return res.status(500).json({ message: 'Failed to generate payslip.' });
    }
  });

  // ── GET /complaints  &  GET /complaints/:id  &  POST /complaints/:id/status ─
  // Complaint management. Admin can filter by status/priority and update tickets.

  router.get('/complaints', ...guard, async (req, res) => {
    const { status, priority, site, search } = req.query;
    try {
      let query = db.collection('complaints').orderBy('created_at', 'desc');
      if (status)   query = query.where('status', '==', status);
      if (priority) query = query.where('priority', '==', priority);

      const snap = await query.limit(100).get();

      let items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id:           doc.id,
          ticket_id:    d.ticket_id,
          client_name:  d.client_name,
          site:         d.site_name   || null,
          subject:      d.subject,
          priority:     d.priority,
          status:       d.status,
          submitted_at: d.created_at ? d.created_at.toDate().toISOString() : null,
          message:      d.description,
          admin_note:   d.admin_note  || null,
        };
      });

      // Firestore doesn't support full-text search — apply site/text filters in memory
      if (site)   items = items.filter(i => i.site === site);
      if (search) {
        const s = search.toLowerCase();
        items = items.filter(i =>
          i.subject.toLowerCase().includes(s) ||
          (i.client_name || '').toLowerCase().includes(s) ||
          (i.ticket_id   || '').toLowerCase().includes(s)
        );
      }

      return res.json(items);
    } catch (err) {
      console.error('admin/complaints error:', err);
      return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
  });

  router.get('/complaints/:id', ...guard, async (req, res) => {
    try {
      const snap = await db.collection('complaints').doc(req.params.id).get();
      if (!snap.exists) return res.status(404).json({ message: 'Complaint not found.' });
      const d = snap.data();
      return res.json({
        id:           snap.id,
        ticket_id:    d.ticket_id,
        client_name:  d.client_name,
        site:         d.site_name   || null,
        subject:      d.subject,
        priority:     d.priority,
        status:       d.status,
        submitted_at: d.created_at ? d.created_at.toDate().toISOString() : null,
        message:      d.description,
        admin_note:   d.admin_note  || null,
      });
    } catch (err) {
      console.error('admin/complaints/:id error:', err);
      return res.status(500).json({ message: 'Failed to fetch complaint.' });
    }
  });

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

      // TODO: Notify client via SMS/email when their ticket status changes
      await logActivity(db, 'complaint', `Complaint ${snap.data().ticket_id} status → ${status}`, 'admin', req.user.uid);

      return res.json({ success: true });
    } catch (err) {
      console.error('admin/complaints/:id/status error:', err);
      return res.status(500).json({ message: 'Failed to update complaint status.' });
    }
  });

  // ── GET /reports ──────────────────────────────────────────────────────────
  // Analytics dashboard. Use ?period= with: this_month, last_month,
  // last_3_months, last_6_months, this_year
  // Returns: attendance rates, incident breakdown, SLA compliance, leave utilisation.
  router.get('/reports', ...guard, async (req, res) => {
    const { period = 'this_month' } = req.query;
    const { from, to } = periodToDateRange(period);

    try {
      // 4 parallel reads across 4 collections — keep this pattern for speed
      const [attendanceSnap, incidentsSnap, complaintsSnap, empSnap] = await Promise.all([
        db.collection('attendance_logs').where('date', '>=', from).where('date', '<=', to).get(),
        db.collection('incidents').where('submitted_at', '>=', new Date(from)).where('submitted_at', '<=', new Date(to + 'T23:59:59')).get(),
        db.collection('complaints').where('created_at', '>=', new Date(from)).get(),
        db.collection('employees').where('status', '==', 'active').get(),
      ]);

      // Attendance rate per site
      const siteAttendance = {};
      attendanceSnap.docs.forEach(doc => {
        const d    = doc.data();
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

      // Incidents broken down by type
      const TYPE_LABELS = {
        trespassing:         'Trespassing',
        suspicious_activity: 'Suspicious Activity',
        theft:               'Theft',
        fire:                'Fire / Hazard',
        equipment_failure:   'Equipment Failure',
        medical:             'Medical Emergency',
        other:               'Other',
      };
      const incidentTypes = {};
      incidentsSnap.docs.forEach(doc => {
        const t = doc.data().type || 'other';
        incidentTypes[t] = (incidentTypes[t] || 0) + 1;
      });
      const incidentsByType = Object.entries(incidentTypes).map(([t, count]) => ({
        type_label: TYPE_LABELS[t] || t,
        count,
      }));

      // SLA compliance — based on 4-hour default response time
      // A ticket is "within SLA" if it was resolved within 4 hours of creation
      const slaHours = 4;
      let within = 0, breached = 0;
      complaintsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.status === 'resolved' && d.created_at && d.updated_at) {
          const hrs = (d.updated_at.toDate() - d.created_at.toDate()) / 3600000;
          if (hrs <= slaHours) within++; else breached++;
        }
      });

      // Leave utilisation — how many days approved per type vs. total available
      const leaveSnap = await db.collection('leave_requests')
        .where('status', '==', 'approved')
        .where('applied_at', '>=', new Date(from))
        .get();
      const leaveByType    = { casual: 0, sick: 0, earned: 0 };
      leaveSnap.docs.forEach(doc => {
        const t = doc.data().leave_type;
        if (leaveByType[t] != null) leaveByType[t]++;
      });
      const empCount      = empSnap.size;
      const LEAVE_ALLOCS  = { casual: 6, sick: 4, earned: 2 }; // must match approval defaults
      const leaveUtilisation = Object.entries(leaveByType).map(([type, days_taken]) => ({
        leave_type_label: { casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave' }[type],
        days_taken,
        days_available: (LEAVE_ALLOCS[type] || 0) * empCount,
      }));

      const total = within + breached;
      return res.json({
        overview: {
          avg_attendance_rate: avgAttendance,
          incidents_reported:  incidentsSnap.size,
          tickets_resolved:    complaintsSnap.docs.filter(d => d.data().status === 'resolved').length,
          avg_resolution_hours: total > 0 ? slaHours : null,
        },
        attendance_by_site:  attendanceBySite,
        sla_compliance: {
          within_sla: within,
          breached,
          rate: total > 0 ? Math.round((within / total) * 1000) / 10 : 100,
        },
        incidents_by_type: incidentsByType,
        leave_utilisation: leaveUtilisation,
        guard_performance: [], // TODO: per-guard attendance rate, incidents filed, leave taken
      });
    } catch (err) {
      console.error('admin/reports error:', err);
      return res.status(500).json({ message: 'Failed to fetch reports.' });
    }
  });

  // ── POST /employees/:id/generate-keycode ──────────────────────────────────
  // Issues a new physical keycode card for a guard.
  // Any existing active keycode is automatically revoked first —
  // a guard can only have ONE active keycode at a time.
  // The keycode is printed on a card the guard keeps — it never expires unless revoked.
  router.post('/employees/:id/generate-keycode', ...guard, async (req, res) => {
    const uid = req.params.id;
    try {
      const empSnap = await db.collection('employees').doc(uid).get();
      if (!empSnap.exists) return res.status(404).json({ message: 'Employee not found.' });
      const emp = empSnap.data();

      // Revoke any existing active keycode for this employee
      const existingSnap = await db.collection('guard_keycodes')
        .where('employee_uid', '==', uid)
        .where('active', '==', true)
        .get();
      const batch = db.batch();
      existingSnap.docs.forEach(d => batch.update(d.ref, { active: false, revoked_at: new Date() }));

      // Generate XXXX-XXXX keycode — excludes 0, O, I, 1 to avoid confusion on printed cards
      const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let keycode;
      let attempts = 0;
      do {
        let raw = '';
        for (let i = 0; i < 8; i++) raw += CHARS[Math.floor(Math.random() * CHARS.length)];
        keycode = raw.slice(0, 4) + '-' + raw.slice(4);
        // Check uniqueness — collision is extremely unlikely but we check anyway
        const existing = await db.collection('guard_keycodes').doc(keycode).get();
        if (!existing.exists) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        return res.status(500).json({ message: 'Could not generate unique keycode. Try again.' });
      }

      batch.set(db.collection('guard_keycodes').doc(keycode), {
        employee_uid: uid,
        employee_id:  emp.employee_id || null,
        name:         emp.name        || null,
        active:       true,
        created_at:   new Date(),
        created_by:   req.user.uid,   // which admin generated it
        last_used_at: null,
      });

      await batch.commit();
      await logActivity(db, 'keycode_generated',
        `Keycode generated for ${emp.name || uid} (${emp.employee_id || uid})`,
        'admin', req.user.uid);

      // Return the keycode — admin prints/shares it with the guard
      return res.json({ keycode, employee_id: emp.employee_id, name: emp.name });
    } catch (err) {
      console.error('generate-keycode error:', err);
      return res.status(500).json({ message: 'Failed to generate keycode.' });
    }
  });

  // ── POST /employees/:id/revoke-keycode ────────────────────────────────────
  // Deactivates the guard's keycode — they can no longer sign in with it.
  // Use this when a guard loses their card or leaves the company.
  router.post('/employees/:id/revoke-keycode', ...guard, async (req, res) => {
    const uid = req.params.id;
    try {
      const snap = await db.collection('guard_keycodes')
        .where('employee_uid', '==', uid)
        .where('active', '==', true)
        .get();
      if (snap.empty) return res.status(404).json({ message: 'No active keycode found for this employee.' });

      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { active: false, revoked_at: new Date() }));
      await batch.commit();
      return res.json({ success: true });
    } catch (err) {
      console.error('revoke-keycode error:', err);
      return res.status(500).json({ message: 'Failed to revoke keycode.' });
    }
  });

  // ── GET /admins — list all admin accounts ─────────────────────────────────
  router.get('/admins', ...guard, async (req, res) => {
    try {
      const snap   = await db.collection('admins').orderBy('created_at', 'desc').get();
      const admins = snap.docs.map(d => ({ id: d.id, ...d.data(),
        created_at: d.data().created_at ? d.data().created_at.toDate().toISOString() : null,
      }));
      return res.json({ admins });
    } catch (e) {
      console.error('admins list error:', e);
      return res.status(500).json({ message: 'Failed to load admins.' });
    }
  });

  // ── POST /admins — create a new admin account ─────────────────────────────
  router.post('/admins', ...guard, async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    try {
      const userRecord = await auth.createUser({ email, password, displayName: name, emailVerified: true });
      await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
      await db.collection('admins').doc(userRecord.uid).set({
        name, email, status: 'active',
        created_by: req.user.uid,
        created_at: new Date(),
      });
      await logActivity(db, 'admin_created',
        `Admin account created for ${name} (${email})`, 'admin', req.user.uid);
      return res.json({ uid: userRecord.uid, name, email });
    } catch (e) {
      console.error('admins create error:', e);
      if (e.code === 'auth/email-already-exists') {
        return res.status(400).json({ message: 'An account with this email already exists.' });
      }
      return res.status(500).json({ message: e.message });
    }
  });

  // ── DELETE /admins/:uid — revoke admin access ──────────────────────────────
  router.delete('/admins/:uid', ...guard, async (req, res) => {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ message: "You can't remove your own admin access." });
    }
    try {
      await auth.setCustomUserClaims(uid, {});
      await db.collection('admins').doc(uid).update({
        status: 'revoked', revoked_at: new Date(), revoked_by: req.user.uid,
      });
      await logActivity(db, 'admin_removed',
        `Admin access revoked for UID ${uid}`, 'admin', req.user.uid);
      return res.json({ message: 'Admin access revoked.' });
    } catch (e) {
      console.error('admins delete error:', e);
      return res.status(500).json({ message: e.message });
    }
  });

  // ── GET /sign-in-events ───────────────────────────────────────────────────
  // Audit log of all keycode sign-ins — who, when, where (GPS), from what device.
  // Optional: ?employee_uid=xxx to filter to one guard. ?limit=N (max 200).
  router.get('/sign-in-events', ...guard, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const empUid = req.query.employee_uid || null;
    try {
      let q = db.collection('sign_in_events').orderBy('timestamp', 'desc');
      if (empUid) q = q.where('employee_uid', '==', empUid);
      q = q.limit(limit);
      const snap   = await q.get();
      const events = snap.docs.map(d => ({
        id:        d.id,
        ...d.data(),
        timestamp: d.data().timestamp ? d.data().timestamp.toDate().toISOString() : null,
      }));
      return res.json({ events });
    } catch (err) {
      console.error('sign-in-events error:', err);
      return res.status(500).json({ message: 'Failed to fetch sign-in events.' });
    }
  });

  return { router };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// These are shared utilities used by the route handlers above.
// They live at the bottom of the file to keep the routes readable.
// ─────────────────────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in server timezone (UTC on Cloud Functions) */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns current month as "YYYY-MM" */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Converts a period string to a { from, to } date range.
 * Used by GET /reports to support multiple time window options.
 * Add more cases here as needed (e.g. 'last_year', 'last_quarter').
 */
function periodToDateRange(period) {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();

  switch (period) {
    case 'last_month':
      return { from: fmtDate(new Date(y, m - 1, 1)), to: fmtDate(new Date(y, m, 0)) };
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

/** Formats a Date as "YYYY-MM-DD" */
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Approve or reject a leave request. Shared between two routes. */
async function setLeaveStatus(db, id, status, res) {
  try {
    const ref  = db.collection('leave_requests').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Leave request not found.' });
    await ref.update({ status, reviewed_at: new Date() });
    // TODO: Notify employee via SMS when their leave is approved or rejected
    return res.json({ success: true });
  } catch (err) {
    console.error(`leave ${status} error:`, err);
    return res.status(500).json({ message: `Failed to ${status} leave.` });
  }
}

/**
 * Deactivate or reactivate an employee.
 * Disabling in Firestore AND in Firebase Auth keeps both systems in sync.
 * If you only disable in one place, the employee could still access the other.
 */
async function setEmployeeStatus(db, auth, id, status, res, adminUid = null) {
  try {
    await db.collection('employees').doc(id).update({ status, updated_at: new Date() });
    await auth.updateUser(id, { disabled: status === 'inactive' }); // mirrors Firestore status
    await logActivity(db, 'other', `Employee ${id} ${status === 'inactive' ? 'deactivated' : 'reactivated'}`, 'admin', adminUid);
    return res.json({ success: true });
  } catch (err) {
    console.error(`employee ${status} error:`, err);
    return res.status(500).json({ message: `Failed to update employee status.` });
  }
}

/**
 * Returns the next employee ID (e.g. VAGT-0042) using an atomic Firestore transaction.
 *
 * Stores the counter in _meta/employee_counter.value so two simultaneous approvals
 * never produce the same ID. On first ever call, seeds from the highest existing
 * employee_id so existing records are never disturbed.
 */
async function nextEmployeeId(db) {
  const counterRef = db.collection('_meta').doc('employee_counter');

  // Seed the counter on first use (runs once in the lifetime of the project).
  const counterSnap = await counterRef.get();
  if (!counterSnap.exists) {
    const empSnap = await db.collection('employees')
      .orderBy('employee_id', 'desc').limit(1).get();
    const lastNum = empSnap.empty
      ? 0
      : parseInt((empSnap.docs[0].data().employee_id || 'VAGT-0000').replace('VAGT-', ''), 10);
    // merge: true so a simultaneous first call doesn't overwrite a concurrent write
    await counterRef.set({ value: lastNum }, { merge: true });
  }

  // Atomically increment — safe under concurrent approvals
  return db.runTransaction(async (txn) => {
    const snap = await txn.get(counterRef);
    const next = (snap.data().value || 0) + 1;
    txn.set(counterRef, { value: next });
    return `VAGT-${String(next).padStart(4, '0')}`;
  });
}

/**
 * Write a line to the activity_log collection.
 * type:     'registration' | 'check_in' | 'check_out' | 'leave_request' | 'complaint' |
 *           'keycode_generated' | 'other'
 * actor:    human-readable label ('admin', a phone number, etc.)
 * actor_uid: Firebase UID of the user performing the action — required for audit.
 *            Pass req.user.uid when available. Defaults to null.
 * Errors are caught and logged but don't fail the parent request —
 * activity logging is best-effort.
 */
async function logActivity(db, type, description, actor, actor_uid = null) {
  try {
    await db.collection('activity_log').add({
      type, description, actor, actor_uid, time: new Date(),
    });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
