/**
 * VAGT Security Services — Firestore Seed Script
 *
 * Seeds Firestore with realistic test data:
 *   - 2 active employees + 1 pending
 *   - 1 client + 1 site
 *   - 1 pending leave request
 *   - 1 open complaint
 *   - 2 attendance logs for today
 *
 * Usage:
 *   cd scripts
 *   GOOGLE_APPLICATION_CREDENTIALS=../firebase/service-account.json node seed-firestore.js
 *
 * Get service account key:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 *   Save as firebase/service-account.json (this file is .gitignored)
 *
 * ⚠️  This will NOT overwrite existing docs with the same IDs.
 *     Safe to run multiple times. To reset, delete the collections in Firestore Console.
 */

'use strict';

const admin = require('firebase-admin');

// ── Init ──────────────────────────────────────────────────────────────────────
const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'vagt---services',
});
const db = admin.firestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
}

async function safeSet(ref, data) {
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  ⏭  Skipping ${ref.path} — already exists`);
    return;
  }
  await ref.set(data);
  console.log(`  ✅  Created ${ref.path}`);
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  VAGT Firestore seed starting...\n');

  // ── Client ─────────────────────────────────────────────────────────────────
  const clientId = 'client-test-techcorp';
  await safeSet(db.collection('clients').doc(clientId), {
    name:       'TechCorp India Pvt Ltd',
    email:      'facilities@techcorp-india.example.com',
    phone:      '+919845000001',
    company:    'TechCorp India Pvt Ltd',
    status:     'active',
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Site ───────────────────────────────────────────────────────────────────
  const siteId = 'site-test-techcorp-hq';
  await safeSet(db.collection('sites').doc(siteId), {
    name:       'TechCorp HQ — Whitefield',
    address:    'ITPL Road, Whitefield, Bengaluru 560066',
    client_uid: clientId,
    active:     true,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Employees ──────────────────────────────────────────────────────────────
  const emp1Id = 'emp-test-ramesh';
  await safeSet(db.collection('employees').doc(emp1Id), {
    name:          'Ramesh Kumar',
    phone:         '+919900000101',
    email:         'ramesh.kumar@vagt.example.com',
    employee_id:   'VAGT-0001',
    status:        'active',
    basic_salary:  18000,
    site_ids:      [siteId],
    leave_balance: { casual: 6, sick: 4, earned: 2 },
    joined_at:     admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
  });

  const emp2Id = 'emp-test-suresh';
  await safeSet(db.collection('employees').doc(emp2Id), {
    name:          'Suresh Naik',
    phone:         '+919900000102',
    email:         'suresh.naik@vagt.example.com',
    employee_id:   'VAGT-0002',
    status:        'active',
    basic_salary:  18000,
    site_ids:      [siteId],
    leave_balance: { casual: 5, sick: 4, earned: 1 },
    joined_at:     admin.firestore.Timestamp.fromDate(new Date('2024-03-01')),
  });

  const emp3Id = 'emp-test-pending';
  await safeSet(db.collection('employees').doc(emp3Id), {
    name:          'Deepak Singh',
    phone:         '+919900000103',
    email:         'deepak.singh@vagt.example.com',
    employee_id:   'VAGT-0003',
    status:        'pending',
    basic_salary:  18000,
    site_ids:      [],
    leave_balance: { casual: 6, sick: 4, earned: 2 },
    joined_at:     admin.firestore.Timestamp.fromDate(new Date('2026-03-10')),
  });

  // ── Attendance logs (today) ─────────────────────────────────────────────────
  const today = todayStr();

  await safeSet(db.collection('attendance_logs').doc(`attend-${emp1Id}-${today}`), {
    employee_uid:  emp1Id,
    employee_name: 'Ramesh Kumar',
    employee_id:   'VAGT-0001',
    date:          today,
    check_in:      admin.firestore.Timestamp.fromDate(new Date(`${today}T07:00:00+05:30`)),
    check_out:     null,
    site_id:       siteId,
    site_name:     'TechCorp HQ — Whitefield',
  });

  await safeSet(db.collection('attendance_logs').doc(`attend-${emp2Id}-${today}`), {
    employee_uid:  emp2Id,
    employee_name: 'Suresh Naik',
    employee_id:   'VAGT-0002',
    date:          today,
    check_in:      admin.firestore.Timestamp.fromDate(new Date(`${today}T07:05:00+05:30`)),
    check_out:     admin.firestore.Timestamp.fromDate(new Date(`${today}T15:05:00+05:30`)),
    site_id:       siteId,
    site_name:     'TechCorp HQ — Whitefield',
  });

  // ── Pending leave request ──────────────────────────────────────────────────
  await safeSet(db.collection('leave_requests').doc('leave-test-001'), {
    employee_uid:  emp1Id,
    employee_name: 'Ramesh Kumar',
    leave_type:    'casual',
    from_date:     '2026-03-20',
    to_date:       '2026-03-21',
    reason:        'Family function in hometown.',
    status:        'pending',
    applied_at:    admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Open complaint ─────────────────────────────────────────────────────────
  await safeSet(db.collection('complaints').doc('complaint-test-001'), {
    ticket_id:    'TCK-0001',
    client_uid:   clientId,
    client_name:  'TechCorp India Pvt Ltd',
    site_id:      siteId,
    site_name:    'TechCorp HQ — Whitefield',
    subject:      'Guard absent during night shift (14 Mar)',
    description:  'The guard assigned to Block B night shift was not present between 02:00 and 04:00. The supervisor was unreachable. This needs immediate attention.',
    priority:     'urgent',
    status:       'open',
    admin_note:   null,
    created_at:   admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('\n✅  Seed complete. Open Firestore Console to verify.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  process.exit(1);
});
