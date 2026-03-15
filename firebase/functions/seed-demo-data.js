/**
 * seed-demo-data.js
 * Populates Firestore with realistic demo data for VAGT Security Services.
 * All seeded documents are tagged { _seed: true } for easy cleanup.
 *
 * Usage (run from firebase/functions/):
 *   node seed-demo-data.js ~/Downloads/<service-account-key>.json
 *
 * To wipe all seed data:
 *   node seed-demo-data.js ~/Downloads/<key>.json --wipe
 */

const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node seed-demo-data.js <path-to-key.json> [--wipe]');
  process.exit(1);
}

const WIPE = process.argv.includes('--wipe');
const resolvedPath = path.resolve(keyPath.replace(/^~/, process.env.HOME));

admin.initializeApp({
  credential: admin.credential.cert(resolvedPath),
  projectId: 'vagt---services',
});

const db = admin.firestore();

// ── Seed data ─────────────────────────────────────────────────────────────────

const SITE_ID  = 'seed-site-prestige-tech';
const SITE_NAME = 'Prestige Tech Park';
const CLIENT_UID = 'seed-client-dsmax-001';
const COMPANY_ID = 'seed-company-dsmax';

const NOW  = new Date();
const d    = (daysAgo) => new Date(NOW - daysAgo * 86400000);
const ts   = (daysAgo, hour = 9, min = 0) => {
  const x = d(daysAgo);
  x.setHours(hour, min, 0, 0);
  return x;
};

const EMPLOYEES = [
  { id: 'seed-emp-ravi',   name: 'Ravi Kumar',    phone: '+919876540001', site_id: SITE_ID, site_name: SITE_NAME, status: 'active',   keycode: 'RVKM-0001', joined_at: d(60) },
  { id: 'seed-emp-suresh', name: 'Suresh Babu',   phone: '+919876540002', site_id: SITE_ID, site_name: SITE_NAME, status: 'active',   keycode: 'SRSH-0002', joined_at: d(45) },
  { id: 'seed-emp-meena',  name: 'Meena Devi',    phone: '+919876540003', site_id: SITE_ID, site_name: SITE_NAME, status: 'active',   keycode: 'MNDI-0003', joined_at: d(30) },
  { id: 'seed-emp-arjun',  name: 'Arjun Singh',   phone: '+919876540004', site_id: SITE_ID, site_name: SITE_NAME, status: 'inactive', keycode: 'ARJN-0004', joined_at: d(90) },
];

const ATTENDANCE = [
  // Ravi: checked in today, not yet out
  { employee_uid: 'seed-emp-ravi',   employee_name: 'Ravi Kumar',  site_name: SITE_NAME, date: NOW.toISOString().slice(0,10), check_in: ts(0, 8, 55), check_out: null },
  // Suresh: checked in and out today
  { employee_uid: 'seed-emp-suresh', employee_name: 'Suresh Babu', site_name: SITE_NAME, date: NOW.toISOString().slice(0,10), check_in: ts(0, 8, 30), check_out: ts(0, 17, 15) },
  // Meena: yesterday
  { employee_uid: 'seed-emp-meena',  employee_name: 'Meena Devi',  site_name: SITE_NAME, date: d(1).toISOString().slice(0,10), check_in: ts(1, 9, 0), check_out: ts(1, 18, 0) },
  // Ravi: yesterday
  { employee_uid: 'seed-emp-ravi',   employee_name: 'Ravi Kumar',  site_name: SITE_NAME, date: d(1).toISOString().slice(0,10), check_in: ts(1, 8, 45), check_out: ts(1, 17, 30) },
];

const LEAVE_REQUESTS = [
  {
    employee_uid: 'seed-emp-suresh', employee_name: 'Suresh Babu',
    leave_type: 'sick', from_date: d(0).toISOString().slice(0,10),
    to_date: d(-2).toISOString().slice(0,10), reason: 'Fever and cold',
    status: 'pending', applied_at: ts(1, 10, 0),
  },
  {
    employee_uid: 'seed-emp-meena', employee_name: 'Meena Devi',
    leave_type: 'casual', from_date: d(-5).toISOString().slice(0,10),
    to_date: d(-5).toISOString().slice(0,10), reason: 'Family function',
    status: 'approved', applied_at: ts(8, 11, 0), reviewed_at: ts(7, 9, 0),
  },
];

const COMPLAINTS = [
  {
    client_uid: CLIENT_UID, client_name: 'DSMax Security',
    site_id: SITE_ID, site_name: SITE_NAME,
    subject: 'Guard not present at gate during peak hours',
    description: 'On 14th March between 9 AM and 10 AM the main gate was unmanned. Visitors were entering without any check.',
    status: 'open', priority: 'high',
    created_at: ts(1, 14, 30), updated_at: ts(1, 14, 30),
    admin_note: null,
  },
  {
    client_uid: CLIENT_UID, client_name: 'DSMax Security',
    site_id: SITE_ID, site_name: SITE_NAME,
    subject: 'Visitor log not maintained properly',
    description: 'Several visitors over the past week have not been logged. We noticed this during our internal audit.',
    status: 'in_progress', priority: 'medium',
    created_at: ts(5, 10, 0), updated_at: ts(3, 16, 0),
    admin_note: 'Guard briefed. New visitor log procedure shared. Monitoring for 1 week.',
  },
  {
    client_uid: CLIENT_UID, client_name: 'DSMax Security',
    site_id: SITE_ID, site_name: SITE_NAME,
    subject: 'Guard uniform not proper',
    description: 'Guard on duty was not in proper uniform on Monday.',
    status: 'resolved', priority: 'low',
    created_at: ts(10, 9, 0), updated_at: ts(9, 11, 0),
    admin_note: 'Spoken to the guard. Will not recur.',
  },
];

const INCIDENTS = [
  {
    employee_uid: 'seed-emp-ravi', employee_name: 'Ravi Kumar',
    site_id: SITE_ID, site_name: SITE_NAME,
    type: 'unauthorized_entry', severity: 'medium',
    description: 'Unknown person attempted to enter the premises through the side gate. Turned away and verified with management.',
    status: 'reported', created_at: ts(2, 22, 15),
  },
];

const SITES = [
  {
    id: SITE_ID,
    name: SITE_NAME,
    address: 'Outer Ring Road, Marathahalli, Bengaluru - 560103',
    client_id: COMPANY_ID,
    client_name: 'DSMax Security',
    guard_count: 3,
    status: 'active',
    created_at: d(90),
  },
];

const COMPANIES = [
  {
    id: COMPANY_ID,
    name: 'DSMax Security',
    contact_name: 'Rajesh Sharma',
    contact_email: CLIENT_UID + '@example.com',
    contact_phone: '+919845001234',
    sites: [SITE_ID],
    created_at: d(90),
  },
];

const ACTIVITY = [
  { action: 'check_in',       message: 'Ravi Kumar checked in',              actor_uid: 'seed-emp-ravi',   created_at: ts(0, 8, 55) },
  { action: 'check_in',       message: 'Suresh Babu checked in',             actor_uid: 'seed-emp-suresh', created_at: ts(0, 8, 30) },
  { action: 'check_out',      message: 'Suresh Babu checked out',            actor_uid: 'seed-emp-suresh', created_at: ts(0, 17, 15) },
  { action: 'leave_request',  message: 'Suresh Babu submitted a leave request', actor_uid: 'seed-emp-suresh', created_at: ts(1, 10, 0) },
  { action: 'complaint_filed', message: 'New complaint: Guard not present at gate', actor_uid: CLIENT_UID, created_at: ts(1, 14, 30) },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function wipeAll() {
  console.log('Wiping all seed data…');
  const collections = ['employees', 'attendance_logs', 'leave_requests', 'complaints', 'incidents', 'sites', 'companies', 'activity_log'];
  for (const col of collections) {
    const snap = await db.collection(col).where('_seed', '==', true).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  deleted ${snap.size} from ${col}`);
  }
  console.log('Done.');
}

async function seedAll() {
  console.log('Seeding demo data…\n');

  // Employees
  for (const emp of EMPLOYEES) {
    const { id, ...data } = emp;
    await db.collection('employees').doc(id).set({ ...data, _seed: true });
    console.log('  ✅ employee:', emp.name);
  }

  // Sites
  for (const site of SITES) {
    const { id, ...data } = site;
    await db.collection('sites').doc(id).set({ ...data, _seed: true });
    console.log('  ✅ site:', site.name);
  }

  // Companies
  for (const co of COMPANIES) {
    const { id, ...data } = co;
    await db.collection('companies').doc(id).set({ ...data, _seed: true });
    console.log('  ✅ company:', co.name);
  }

  // Attendance
  for (const log of ATTENDANCE) {
    await db.collection('attendance_logs').add({ ...log, _seed: true });
  }
  console.log(`  ✅ attendance logs: ${ATTENDANCE.length}`);

  // Leave requests
  for (const lr of LEAVE_REQUESTS) {
    await db.collection('leave_requests').add({ ...lr, _seed: true });
  }
  console.log(`  ✅ leave requests: ${LEAVE_REQUESTS.length}`);

  // Complaints
  for (const c of COMPLAINTS) {
    await db.collection('complaints').add({ ...c, _seed: true });
  }
  console.log(`  ✅ complaints: ${COMPLAINTS.length}`);

  // Incidents
  for (const inc of INCIDENTS) {
    await db.collection('incidents').add({ ...inc, _seed: true });
  }
  console.log(`  ✅ incidents: ${INCIDENTS.length}`);

  // Activity log
  for (const a of ACTIVITY) {
    await db.collection('activity_log').add({ ...a, _seed: true });
  }
  console.log(`  ✅ activity log: ${ACTIVITY.length}`);

  console.log('\n✅ All done. Refresh the admin dashboard.');
  console.log('   To wipe: node seed-demo-data.js <key.json> --wipe\n');
}

// ── Run ───────────────────────────────────────────────────────────────────────

(WIPE ? wipeAll() : seedAll()).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
