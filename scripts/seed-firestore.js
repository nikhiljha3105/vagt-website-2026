/**
 * VAGT Security Services — Firestore Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Creates realistic test data across all major collections AND creates
 * Firebase Auth accounts so you can actually log in and test every portal.
 *
 * USAGE:
 *   cd scripts
 *   GOOGLE_APPLICATION_CREDENTIALS=../firebase/service-account.json node seed-firestore.js
 *
 *   # To wipe test data and re-seed from scratch:
 *   GOOGLE_APPLICATION_CREDENTIALS=../firebase/service-account.json node seed-firestore.js --reset
 *
 * GET SERVICE ACCOUNT KEY:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 *   Save as firebase/service-account.json  (already in .gitignore — never commit it)
 *
 * TEST LOGIN CREDENTIALS (printed again at end of run):
 *   Admin  : hello@vagtservices.com       / Vagt@2026Admin    (already live)
 *   Guard 1: ramesh.kumar@vagt-test.com   / TestGuard@001
 *   Guard 2: suresh.naik@vagt-test.com    / TestGuard@002
 *   Client : facilities@techcorp-test.com / TestClient@001
 *
 * WHAT IS SEEDED:
 *   Firebase Auth  — 3 guard accounts + 1 client account (all with correct role claims)
 *   employees      — 2 active guards, 1 pending approval
 *   clients        — 1 client (TechCorp India)
 *   sites          — 2 sites assigned to TechCorp
 *   attendance_logs— 7 days of history + today
 *   leave_requests — 1 pending, 1 approved, 1 rejected
 *   payslips       — 2 months for each active guard
 *   incidents      — 2 (1 medium, 1 high)
 *   shifts         — next 7 days for both guards
 *   complaints     — 3 tickets (open, in_progress, resolved)
 *   invoices       — 2 invoices (1 unpaid, 1 paid)
 *   daily_reports  — 3 recent reports
 *   guard_keycodes — 1 keycode for guard 1
 *   activity_log   — 5 recent activity entries
 */

'use strict';

const admin = require('firebase-admin');

// ── Init ──────────────────────────────────────────────────────────────────────
const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  'vagt---services',
});
const db   = admin.firestore(app);
const auth = admin.auth(app);

const RESET = process.argv.includes('--reset');

// ── Helpers ───────────────────────────────────────────────────────────────────

function istDate(offsetDays = 0) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const d = new Date(Date.now() + IST_OFFSET_MS + offsetDays * 86400000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function istTimestamp(dateStr, timeStr) {
  // e.g. istTimestamp('2026-03-16', '07:00') → Date at 07:00 IST
  return new Date(`${dateStr}T${timeStr}:00+05:30`);
}

// Writes doc, skipping if it already exists (unless --reset).
async function safeSet(ref, data) {
  if (!RESET) {
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`  ⏭  ${ref.path} — already exists, skipping`);
      return;
    }
  }
  await ref.set(data);
  console.log(`  ✅  ${ref.path}`);
}

// Creates or updates a Firebase Auth user. Returns the UID.
async function upsertAuthUser({ email, password, displayName, disabled = false }) {
  try {
    const existing = await auth.getUserByEmail(email);
    if (RESET) {
      await auth.updateUser(existing.uid, { password, displayName, disabled });
      console.log(`  🔄  Auth updated: ${email}`);
    } else {
      console.log(`  ⏭  Auth exists:  ${email}`);
    }
    return existing.uid;
  } catch {
    // User doesn't exist — create
    const u = await auth.createUser({ email, password, displayName, disabled });
    console.log(`  ✅  Auth created: ${email}`);
    return u.uid;
  }
}

async function setRole(uid, role) {
  await auth.setCustomUserClaims(uid, { role });
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\n🌱  VAGT seed starting… (mode: ${RESET ? 'RESET' : 'safe/skip'})\n`);

  // ── Firebase Auth accounts ─────────────────────────────────────────────────
  console.log('── Auth accounts');

  const guard1Uid = await upsertAuthUser({
    email:       'ramesh.kumar@vagt-test.com',
    password:    'TestGuard@001',
    displayName: 'Ramesh Kumar',
    disabled:    false,
  });
  await setRole(guard1Uid, 'employee');

  const guard2Uid = await upsertAuthUser({
    email:       'suresh.naik@vagt-test.com',
    password:    'TestGuard@002',
    displayName: 'Suresh Naik',
    disabled:    false,
  });
  await setRole(guard2Uid, 'employee');

  // Guard 3 is pending approval — account is disabled until admin approves
  const guard3Uid = await upsertAuthUser({
    email:       'deepak.singh@vagt-test.com',
    password:    'TestGuard@003',
    displayName: 'Deepak Singh',
    disabled:    true,
  });
  // No role claim — pending guards have no claim until approved

  const clientUid = await upsertAuthUser({
    email:       'facilities@techcorp-test.com',
    password:    'TestClient@001',
    displayName: 'Amit Mehta (TechCorp)',
    disabled:    false,
  });
  await setRole(clientUid, 'client');

  // ── Sites ──────────────────────────────────────────────────────────────────
  console.log('\n── Sites');

  const site1Id = 'site-test-techcorp-whitefield';
  await safeSet(db.collection('sites').doc(site1Id), {
    name:             'TechCorp HQ — Whitefield',
    address:          'ITPL Road, Whitefield, Bengaluru 560066',
    client_uid:       clientUid,
    guards_deployed:  2,
    coverage_status:  'covered',
    active:           true,
    created_at:       admin.firestore.FieldValue.serverTimestamp(),
  });

  const site2Id = 'site-test-techcorp-ecity';
  await safeSet(db.collection('sites').doc(site2Id), {
    name:             'TechCorp Electronics City Block B',
    address:          'Phase 1, Electronics City, Bengaluru 560100',
    client_uid:       clientUid,
    guards_deployed:  1,
    coverage_status:  'covered',
    active:           true,
    created_at:       admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Client ────────────────────────────────────────────────────────────────
  console.log('\n── Client');

  await safeSet(db.collection('clients').doc(clientUid), {
    name:         'Amit Mehta',
    company_name: 'TechCorp India Pvt Ltd',
    email:        'facilities@techcorp-test.com',
    phone:        '+919845000001',
    site_id:      site1Id,
    site_name:    'TechCorp HQ — Whitefield',
    status:       'active',
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Employees ─────────────────────────────────────────────────────────────
  console.log('\n── Employees');

  await safeSet(db.collection('employees').doc(guard1Uid), {
    name:          'Ramesh Kumar',
    phone:         '+919900000101',
    email:         'ramesh.kumar@vagt-test.com',
    employee_id:   'VAGT-0001',
    status:        'active',
    site_name:     'TechCorp HQ — Whitefield',
    site_ids:      [site1Id],
    basic_salary:  18000,
    allowances:    2000,
    gross_pay:     20000,
    deductions:    2400,
    net_pay:       17600,
    leave_balance: { casual: 6, sick: 4, earned: 2 },
    joined_at:     admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
    created_at:    admin.firestore.FieldValue.serverTimestamp(),
  });

  await safeSet(db.collection('employees').doc(guard2Uid), {
    name:          'Suresh Naik',
    phone:         '+919900000102',
    email:         'suresh.naik@vagt-test.com',
    employee_id:   'VAGT-0002',
    status:        'active',
    site_name:     'TechCorp Electronics City Block B',
    site_ids:      [site2Id],
    basic_salary:  18000,
    allowances:    2000,
    gross_pay:     20000,
    deductions:    2400,
    net_pay:       17600,
    leave_balance: { casual: 5, sick: 4, earned: 1 },
    joined_at:     admin.firestore.Timestamp.fromDate(new Date('2024-03-01')),
    created_at:    admin.firestore.FieldValue.serverTimestamp(),
  });

  // Guard 3 — pending approval, no employee doc yet (admin creates it on approval)
  await safeSet(db.collection('pending_registrations').doc('reg-test-deepak'), {
    phone:        '+919900000103',
    email:        'deepak.singh@vagt-test.com',
    name:         'Deepak Singh',
    otp:          '000000',        // dummy — SMS not wired
    verified:     true,
    firebase_uid: guard3Uid,
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
    verified_at:  admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Attendance logs (past 7 days + today) ─────────────────────────────────
  console.log('\n── Attendance logs');

  for (let i = 6; i >= 0; i--) {
    const date = istDate(-i);

    // Guard 1 — checked in and out every day
    await safeSet(db.collection('attendance_logs').doc(`att-g1-${date}`), {
      employee_uid:  guard1Uid,
      employee_name: 'Ramesh Kumar',
      employee_id:   'VAGT-0001',
      date,
      site_id:       site1Id,
      site_name:     'TechCorp HQ — Whitefield',
      check_in:      admin.firestore.Timestamp.fromDate(istTimestamp(date, '07:00')),
      check_out:     i === 0
        ? null   // today — still on duty
        : admin.firestore.Timestamp.fromDate(istTimestamp(date, '15:00')),
      missed_checkout: false,
    });

    // Guard 2 — missed checkout 2 days ago (tests the flagMissedCheckouts job)
    const guard2CheckOut = i === 2
      ? null
      : i === 0
        ? null
        : admin.firestore.Timestamp.fromDate(istTimestamp(date, '15:05'));
    await safeSet(db.collection('attendance_logs').doc(`att-g2-${date}`), {
      employee_uid:    guard2Uid,
      employee_name:   'Suresh Naik',
      employee_id:     'VAGT-0002',
      date,
      site_id:         site2Id,
      site_name:       'TechCorp Electronics City Block B',
      check_in:        admin.firestore.Timestamp.fromDate(istTimestamp(date, '07:05')),
      check_out:       guard2CheckOut,
      missed_checkout: i === 2,  // flagged by the scheduled job
    });
  }

  // ── Shifts (next 7 days) ──────────────────────────────────────────────────
  console.log('\n── Shifts');

  for (let i = 0; i < 7; i++) {
    const date = istDate(i);

    await safeSet(db.collection('shifts').doc(`shift-g1-${date}`), {
      employee_uid:  guard1Uid,
      employee_name: 'Ramesh Kumar',
      employee_id:   'VAGT-0001',
      site_id:       site1Id,
      site_name:     'TechCorp HQ — Whitefield',
      site_address:  'ITPL Road, Whitefield, Bengaluru 560066',
      date,
      shift_type:    'morning',
      start_time:    '07:00',
      end_time:      '15:00',
    });

    await safeSet(db.collection('shifts').doc(`shift-g2-${date}`), {
      employee_uid:  guard2Uid,
      employee_name: 'Suresh Naik',
      employee_id:   'VAGT-0002',
      site_id:       site2Id,
      site_name:     'TechCorp Electronics City Block B',
      site_address:  'Phase 1, Electronics City, Bengaluru 560100',
      date,
      shift_type:    'morning',
      start_time:    '07:00',
      end_time:      '15:00',
    });
  }

  // ── Leave requests ────────────────────────────────────────────────────────
  console.log('\n── Leave requests');

  await safeSet(db.collection('leave_requests').doc('leave-test-001'), {
    employee_uid:  guard1Uid,
    employee_name: 'Ramesh Kumar',
    leave_type:    'casual',
    from_date:     '2026-03-20',
    to_date:       '2026-03-21',
    reason:        'Family function in hometown.',
    status:        'pending',
    applied_at:    admin.firestore.FieldValue.serverTimestamp(),
  });

  await safeSet(db.collection('leave_requests').doc('leave-test-002'), {
    employee_uid:  guard2Uid,
    employee_name: 'Suresh Naik',
    leave_type:    'sick',
    from_date:     '2026-03-10',
    to_date:       '2026-03-10',
    reason:        'Fever and throat infection.',
    status:        'approved',
    applied_at:    admin.firestore.Timestamp.fromDate(new Date('2026-03-09T09:00:00+05:30')),
    reviewed_at:   admin.firestore.Timestamp.fromDate(new Date('2026-03-09T11:00:00+05:30')),
    reviewed_by:   'hello@vagtservices.com',
  });

  await safeSet(db.collection('leave_requests').doc('leave-test-003'), {
    employee_uid:  guard1Uid,
    employee_name: 'Ramesh Kumar',
    leave_type:    'earned',
    from_date:     '2026-02-14',
    to_date:       '2026-02-16',
    reason:        'Personal travel.',
    status:        'rejected',
    applied_at:    admin.firestore.Timestamp.fromDate(new Date('2026-02-10T09:00:00+05:30')),
    reviewed_at:   admin.firestore.Timestamp.fromDate(new Date('2026-02-11T10:00:00+05:30')),
    reviewed_by:   'hello@vagtservices.com',
    rejection_note: 'Insufficient earned leave balance.',
  });

  // ── Payslips ──────────────────────────────────────────────────────────────
  console.log('\n── Payslips');

  for (const [uid, name, empId] of [
    [guard1Uid, 'Ramesh Kumar', 'VAGT-0001'],
    [guard2Uid, 'Suresh Naik',  'VAGT-0002'],
  ]) {
    for (const period of ['2026-02', '2026-01']) {
      await safeSet(db.collection('payslips').doc(`slip-${empId}-${period}`), {
        employee_uid:  uid,
        employee_name: name,
        employee_id:   empId,
        period,
        basic:         18000,
        allowances:    2000,
        gross_pay:     20000,
        deductions:    2400,
        net_pay:       17600,
        pdf_url:       null,
        generated_at:  admin.firestore.Timestamp.fromDate(new Date(`${period}-28T10:00:00+05:30`)),
      });
    }
  }

  // ── Incidents ─────────────────────────────────────────────────────────────
  console.log('\n── Incidents');

  await safeSet(db.collection('incidents').doc('inc-test-001'), {
    employee_uid:     guard1Uid,
    employee_name:    'Ramesh Kumar',
    reference_number: 'INC-2026-1001',
    type:             'suspicious_activity',
    severity:         'medium',
    site_id:          site1Id,
    site_name:        'TechCorp HQ — Whitefield',
    site_client_uid:  clientUid,
    description:      'Unknown individual loitering near server room entrance for approximately 20 minutes. Escorted off premises. No access gained.',
    persons_involved: 'Unknown male, approximately 30–35 years, blue shirt.',
    action_taken:     'Escorted individual off premises. CCTV footage saved.',
    occurred_at:      admin.firestore.Timestamp.fromDate(new Date('2026-03-14T22:30:00+05:30')),
    status:           'acknowledged',
    submitted_at:     admin.firestore.Timestamp.fromDate(new Date('2026-03-14T22:45:00+05:30')),
  });

  await safeSet(db.collection('incidents').doc('inc-test-002'), {
    employee_uid:     guard2Uid,
    employee_name:    'Suresh Naik',
    reference_number: 'INC-2026-1002',
    type:             'equipment_failure',
    severity:         'low',
    site_id:          site2Id,
    site_name:        'TechCorp Electronics City Block B',
    site_client_uid:  clientUid,
    description:      'Main gate intercom unit stopped working. Guests had to be manually verified.',
    persons_involved: null,
    action_taken:     'Reported to facilities team. Manual verification in place until repaired.',
    occurred_at:      admin.firestore.Timestamp.fromDate(new Date('2026-03-15T09:00:00+05:30')),
    status:           'submitted',
    submitted_at:     admin.firestore.Timestamp.fromDate(new Date('2026-03-15T09:15:00+05:30')),
  });

  // ── Complaints ────────────────────────────────────────────────────────────
  console.log('\n── Complaints');

  await safeSet(db.collection('complaints').doc('cmp-test-001'), {
    ticket_id:   'TKT-2026-AAAA',
    client_uid:  clientUid,
    client_name: 'Amit Mehta',
    site_id:     site1Id,
    site_name:   'TechCorp HQ — Whitefield',
    type:        'complaint',
    priority:    'urgent',
    subject:     'Guard absent during night shift (14 Mar)',
    description: 'The guard assigned to Block B night shift was not present between 02:00 and 04:00. The duty manager was unreachable. This is the second time this month.',
    status:      'open',
    admin_note:  null,
    created_at:  admin.firestore.Timestamp.fromDate(new Date('2026-03-14T08:00:00+05:30')),
  });

  await safeSet(db.collection('complaints').doc('cmp-test-002'), {
    ticket_id:   'TKT-2026-BBBB',
    client_uid:  clientUid,
    client_name: 'Amit Mehta',
    site_id:     site1Id,
    site_name:   'TechCorp HQ — Whitefield',
    type:        'service_request',
    priority:    'medium',
    subject:     'Request for additional guard on 22 March (board meeting)',
    description: 'We have a board meeting on 22 March with external visitors. Can we arrange one additional guard for the day?',
    status:      'in_progress',
    admin_note:  'Checking availability. Will confirm by 18 March.',
    created_at:  admin.firestore.Timestamp.fromDate(new Date('2026-03-15T10:00:00+05:30')),
    updated_at:  admin.firestore.Timestamp.fromDate(new Date('2026-03-15T14:00:00+05:30')),
  });

  await safeSet(db.collection('complaints').doc('cmp-test-003'), {
    ticket_id:   'TKT-2026-CCCC',
    client_uid:  clientUid,
    client_name: 'Amit Mehta',
    site_id:     site2Id,
    site_name:   'TechCorp Electronics City Block B',
    type:        'feedback',
    priority:    'low',
    subject:     'Guard Suresh was very helpful during fire drill',
    description: 'Suresh Naik went above and beyond during our fire drill on 10 March. Please pass on our appreciation.',
    status:      'resolved',
    admin_note:  'Thank you — we have shared your feedback with Suresh and his supervisor.',
    created_at:  admin.firestore.Timestamp.fromDate(new Date('2026-03-11T09:00:00+05:30')),
    updated_at:  admin.firestore.Timestamp.fromDate(new Date('2026-03-11T11:00:00+05:30')),
  });

  // ── Invoices ──────────────────────────────────────────────────────────────
  console.log('\n── Invoices');

  await safeSet(db.collection('invoices').doc('inv-test-001'), {
    client_uid:     clientUid,
    invoice_number: 'VAGT-2026-0001',
    period_label:   'February 2026',
    issued_date:    '2026-03-01',
    due_date:       '2026-03-15',
    amount:         62000,
    status:         'overdue',
    paid_amount:    null,
    pdf_url:        null,
  });

  await safeSet(db.collection('invoices').doc('inv-test-002'), {
    client_uid:     clientUid,
    invoice_number: 'VAGT-2026-0002',
    period_label:   'January 2026',
    issued_date:    '2026-02-01',
    due_date:       '2026-02-15',
    amount:         62000,
    status:         'paid',
    paid_amount:    62000,
    paid_date:      '2026-02-12',
    pdf_url:        null,
  });

  // ── Daily reports ─────────────────────────────────────────────────────────
  console.log('\n── Daily reports');

  for (let i = 1; i <= 3; i++) {
    const date = istDate(-i);
    await safeSet(db.collection('daily_reports').doc(`rpt-test-g1-${date}`), {
      site_id:        site1Id,
      site_name:      'TechCorp HQ — Whitefield',
      site_client_uid: clientUid,
      date,
      report_type:    'daily',
      guard_name:     'Ramesh Kumar',
      employee_uid:   guard1Uid,
      summary:        'All clear. No incidents. 48 visitors logged.',
      details:        null,
      submitted_at:   admin.firestore.Timestamp.fromDate(istTimestamp(date, '15:10')),
    });
  }

  // ── Guard keycode ─────────────────────────────────────────────────────────
  console.log('\n── Guard keycode');

  await safeSet(db.collection('guard_keycodes').doc('ABCD-1234'), {
    employee_uid: guard1Uid,
    employee_id:  'VAGT-0001',
    name:         'Ramesh Kumar',
    active:       true,
    issued_at:    admin.firestore.Timestamp.fromDate(new Date('2024-01-15T10:00:00+05:30')),
    last_used_at: null,
  });

  // ── Activity log ──────────────────────────────────────────────────────────
  console.log('\n── Activity log');

  const activities = [
    { type: 'check_in',      description: 'Ramesh Kumar checked in',                            actor: guard1Uid },
    { type: 'check_in',      description: 'Suresh Naik checked in',                             actor: guard2Uid },
    { type: 'leave_request', description: 'Ramesh Kumar applied for casual leave',              actor: guard1Uid },
    { type: 'complaint',     description: 'New complaint from Amit Mehta: Guard absent night',  actor: clientUid },
    { type: 'registration',  description: 'New employee registration request from Deepak Singh', actor: guard3Uid },
  ];

  for (let i = 0; i < activities.length; i++) {
    const docId = `act-test-00${i + 1}`;
    await safeSet(db.collection('activity_log').doc(docId), {
      ...activities[i],
      time: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - (activities.length - i) * 20 * 60 * 1000) // staggered ~20 min apart
      ),
    });
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
╔════════════════════════════════════════════════════════╗
║         ✅  VAGT seed complete                         ║
╠════════════════════════════════════════════════════════╣
║  Portal URL: https://vagt---services.web.app/          ║
║                                                        ║
║  TEST LOGIN CREDENTIALS                                ║
║  ─────────────────────────────────────────────────── ║
║  Admin   hello@vagtservices.com   Vagt@2026Admin       ║
║  Guard 1 ramesh.kumar@vagt-test.com  TestGuard@001     ║
║  Guard 2 suresh.naik@vagt-test.com   TestGuard@002     ║
║  Client  facilities@techcorp-test.com TestClient@001   ║
║                                                        ║
║  Keycode login (guard 1): ABCD-1234                    ║
╚════════════════════════════════════════════════════════╝
`);
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message, '\n');
  process.exit(1);
});
