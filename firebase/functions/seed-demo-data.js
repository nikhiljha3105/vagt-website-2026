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
 *
 * Collections populated:
 *   employees (10), sites (3), companies (3), attendance_logs (24),
 *   leave_requests (7), complaints (7), incidents (5), guest_logs (12),
 *   patrol_checkpoints (6), patrol_logs (10), payslips (5),
 *   invoices (4), activity_log (20)
 *
 * Total: 113 documents
 */

'use strict';

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

// ── Time helpers ──────────────────────────────────────────────────────────────

const NOW  = new Date();
// IST = UTC + 5:30
const istNow = new Date(NOW.getTime() + 5.5 * 60 * 60 * 1000);

function d(daysAgo) {
  return new Date(NOW.getTime() - daysAgo * 86400000);
}
function ts(daysAgo, hour = 9, min = 0) {
  const x = d(daysAgo);
  x.setHours(hour, min, 0, 0);
  return x;
}
function istDate(daysAgo) {
  const x = new Date(istNow.getTime() - daysAgo * 86400000);
  return x.toISOString().slice(0, 10);
}

// ── IDs ───────────────────────────────────────────────────────────────────────

const SITE_PRESTIGE  = 'seed-site-prestige-tech';
const SITE_BRIGADE   = 'seed-site-brigade-gateway';
const SITE_MANYATA   = 'seed-site-manyata-tech';

const CO_DSMAX       = 'seed-company-dsmax';
const CO_BRIGADE     = 'seed-company-brigade';
const CO_PRESTIGE    = 'seed-company-prestige';

const CL_DSMAX       = 'seed-client-dsmax-001';
const CL_BRIGADE     = 'seed-client-brigade-001';
const CL_PRESTIGE    = 'seed-client-prestige-001';

// ── Companies (clients) ───────────────────────────────────────────────────────

const COMPANIES = [
  {
    id: CO_DSMAX,
    name: 'DSMax Properties Pvt. Ltd.',
    contact_name: 'Rajesh Sharma',
    contact_email: 'rajesh.sharma@dsmax.in',
    contact_phone: '+919845001234',
    sites: [SITE_PRESTIGE],
    gstin: '29AABCD1234F1Z5',
    address: '4th Floor, DSMax Tower, Koramangala, Bengaluru - 560034',
    created_at: d(180),
  },
  {
    id: CO_BRIGADE,
    name: 'Brigade Enterprises Ltd.',
    contact_name: 'Sunita Nair',
    contact_email: 'sunita.nair@brigadegroup.com',
    contact_phone: '+919880123456',
    sites: [SITE_BRIGADE],
    gstin: '29AABCE4567G2Z8',
    address: 'Brigade Gateway, 26/1, Dr. Rajkumar Road, Bengaluru - 560055',
    created_at: d(120),
  },
  {
    id: CO_PRESTIGE,
    name: 'Prestige Estates Projects Ltd.',
    contact_name: 'Arvind Krishnan',
    contact_email: 'arvind.k@prestigeconstructions.com',
    contact_phone: '+919741234567',
    sites: [SITE_MANYATA],
    gstin: '29AABCF7890H3Z1',
    address: 'The Falcon House, No. 1, Main Guard Cross Road, Bengaluru - 560001',
    created_at: d(90),
  },
];

// ── Sites ─────────────────────────────────────────────────────────────────────

const SITES = [
  {
    id: SITE_PRESTIGE,
    name: 'Prestige Tech Park',
    address: 'Outer Ring Road, Marathahalli, Bengaluru - 560103',
    client_id: CO_DSMAX,
    client_name: 'DSMax Properties Pvt. Ltd.',
    guard_count: 4,
    posts_required: 3,
    shift_hours: 12,
    latitude: 12.9591,
    longitude: 77.6974,
    geofence_radius_m: 200,
    status: 'active',
    created_at: d(180),
  },
  {
    id: SITE_BRIGADE,
    name: 'Brigade Gateway',
    address: '26/1, Dr. Rajkumar Road, Rajajinagar, Bengaluru - 560055',
    client_id: CO_BRIGADE,
    client_name: 'Brigade Enterprises Ltd.',
    guard_count: 3,
    posts_required: 2,
    shift_hours: 8,
    latitude: 12.9915,
    longitude: 77.5550,
    geofence_radius_m: 150,
    status: 'active',
    created_at: d(120),
  },
  {
    id: SITE_MANYATA,
    name: 'Manyata Tech Park — Block D',
    address: 'Manyata Embassy Business Park, Nagawara, Bengaluru - 560045',
    client_id: CO_PRESTIGE,
    client_name: 'Prestige Estates Projects Ltd.',
    guard_count: 3,
    posts_required: 2,
    shift_hours: 12,
    latitude: 13.0475,
    longitude: 77.6202,
    geofence_radius_m: 180,
    status: 'active',
    created_at: d(90),
  },
];

// ── Employees (guards) ────────────────────────────────────────────────────────

const EMPLOYEES = [
  {
    id: 'seed-emp-ravi',
    employee_id: 'VAGT-0001',
    name: 'Ravi Kumar',
    phone: '9876540001',
    email: 'ravi.kumar@vagttest.com',
    site_ids: [SITE_PRESTIGE],
    site_name: 'Prestige Tech Park',
    status: 'active',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '4521',
    joined_at: d(180),
    leave_balance: { casual: 4, sick: 3, earned: 2 },
  },
  {
    id: 'seed-emp-suresh',
    employee_id: 'VAGT-0002',
    name: 'Suresh Babu',
    phone: '9876540002',
    email: 'suresh.babu@vagttest.com',
    site_ids: [SITE_PRESTIGE],
    site_name: 'Prestige Tech Park',
    status: 'active',
    shift: 'night',
    designation: 'Security Guard',
    aadhar_last4: '3302',
    joined_at: d(160),
    leave_balance: { casual: 5, sick: 4, earned: 1 },
  },
  {
    id: 'seed-emp-meena',
    employee_id: 'VAGT-0003',
    name: 'Meena Devi',
    phone: '9876540003',
    email: 'meena.devi@vagttest.com',
    site_ids: [SITE_PRESTIGE],
    site_name: 'Prestige Tech Park',
    status: 'active',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '7891',
    joined_at: d(120),
    leave_balance: { casual: 6, sick: 4, earned: 2 },
  },
  {
    id: 'seed-emp-venkat',
    employee_id: 'VAGT-0004',
    name: 'Venkatesh Reddy',
    phone: '9876540004',
    email: 'venkat.reddy@vagttest.com',
    site_ids: [SITE_BRIGADE],
    site_name: 'Brigade Gateway',
    status: 'active',
    shift: 'day',
    designation: 'Senior Security Guard',
    aadhar_last4: '2214',
    joined_at: d(150),
    leave_balance: { casual: 3, sick: 2, earned: 3 },
  },
  {
    id: 'seed-emp-priya',
    employee_id: 'VAGT-0005',
    name: 'Priya Lakshmi',
    phone: '9876540005',
    email: 'priya.lakshmi@vagttest.com',
    site_ids: [SITE_BRIGADE],
    site_name: 'Brigade Gateway',
    status: 'active',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '9983',
    joined_at: d(100),
    leave_balance: { casual: 6, sick: 4, earned: 0 },
  },
  {
    id: 'seed-emp-irfan',
    employee_id: 'VAGT-0006',
    name: 'Mohammad Irfan',
    phone: '9876540006',
    email: 'm.irfan@vagttest.com',
    site_ids: [SITE_BRIGADE],
    site_name: 'Brigade Gateway',
    status: 'active',
    shift: 'night',
    designation: 'Security Guard',
    aadhar_last4: '4456',
    joined_at: d(75),
    leave_balance: { casual: 6, sick: 4, earned: 0 },
  },
  {
    id: 'seed-emp-ramesh',
    employee_id: 'VAGT-0007',
    name: 'Ramesh Gowda',
    phone: '9876540007',
    email: 'ramesh.gowda@vagttest.com',
    site_ids: [SITE_MANYATA],
    site_name: 'Manyata Tech Park — Block D',
    status: 'active',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '6670',
    joined_at: d(60),
    leave_balance: { casual: 6, sick: 4, earned: 0 },
  },
  {
    id: 'seed-emp-deepak',
    employee_id: 'VAGT-0008',
    name: 'Deepak Singh',
    phone: '9876540008',
    email: 'deepak.singh@vagttest.com',
    site_ids: [SITE_MANYATA],
    site_name: 'Manyata Tech Park — Block D',
    status: 'active',
    shift: 'night',
    designation: 'Security Guard',
    aadhar_last4: '1123',
    joined_at: d(55),
    leave_balance: { casual: 6, sick: 4, earned: 0 },
  },
  {
    id: 'seed-emp-kavitha',
    employee_id: 'VAGT-0009',
    name: 'Kavitha Nair',
    phone: '9876540009',
    email: 'kavitha.nair@vagttest.com',
    site_ids: [SITE_MANYATA],
    site_name: 'Manyata Tech Park — Block D',
    status: 'active',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '5512',
    joined_at: d(40),
    leave_balance: { casual: 6, sick: 4, earned: 0 },
  },
  {
    id: 'seed-emp-arjun',
    employee_id: 'VAGT-0010',
    name: 'Arjun Singh',
    phone: '9876540010',
    email: 'arjun.singh@vagttest.com',
    site_ids: [SITE_PRESTIGE],
    site_name: 'Prestige Tech Park',
    status: 'inactive',
    shift: 'day',
    designation: 'Security Guard',
    aadhar_last4: '8834',
    joined_at: d(200),
    left_at: d(10),
    leave_balance: { casual: 0, sick: 0, earned: 0 },
  },
];

// ── Attendance logs (24 entries across 7 days) ────────────────────────────────

const ATTENDANCE = [
  // Today
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(0), check_in: ts(0, 8, 52), check_out: null },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(0), check_in: ts(0, 9, 3),  check_out: null },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(0), check_in: ts(0, 8, 45), check_out: null },
  { employee_uid: 'seed-emp-priya',  employee_id: 'VAGT-0005', employee_name: 'Priya Lakshmi',  site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(0), check_in: ts(0, 9, 10), check_out: null },
  { employee_uid: 'seed-emp-ramesh', employee_id: 'VAGT-0007', employee_name: 'Ramesh Gowda',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(0), check_in: ts(0, 8, 58), check_out: null },
  // Yesterday
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(1), check_in: ts(1, 8, 48), check_out: ts(1, 20, 55) },
  { employee_uid: 'seed-emp-suresh', employee_id: 'VAGT-0002', employee_name: 'Suresh Babu',    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(1), check_in: ts(1, 20, 10),check_out: ts(1, 23, 59) },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(1), check_in: ts(1, 9, 0),  check_out: ts(1, 21, 5) },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(1), check_in: ts(1, 8, 50), check_out: ts(1, 17, 5) },
  { employee_uid: 'seed-emp-irfan',  employee_id: 'VAGT-0006', employee_name: 'Mohammad Irfan', site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(1), check_in: ts(1, 21, 0), check_out: ts(1, 23, 45) },
  // 2 days ago
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(2), check_in: ts(2, 9, 2),  check_out: ts(2, 21, 0) },
  { employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(2), check_in: ts(2, 20, 55),check_out: ts(2, 23, 50) },
  { employee_uid: 'seed-emp-ramesh', employee_id: 'VAGT-0007', employee_name: 'Ramesh Gowda',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(2), check_in: ts(2, 8, 45), check_out: ts(2, 20, 50) },
  { employee_uid: 'seed-emp-kavitha',employee_id: 'VAGT-0009', employee_name: 'Kavitha Nair',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(2), check_in: ts(2, 9, 5),  check_out: ts(2, 21, 10) },
  // 3 days ago
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(3), check_in: ts(3, 8, 40), check_out: ts(3, 17, 0) },
  { employee_uid: 'seed-emp-priya',  employee_id: 'VAGT-0005', employee_name: 'Priya Lakshmi',  site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(3), check_in: ts(3, 9, 15), check_out: ts(3, 18, 0) },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(3), check_in: ts(3, 8, 55), check_out: ts(3, 21, 5) },
  // 4-5 days ago
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',     site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',           date: istDate(4), check_in: ts(4, 9, 0),  check_out: ts(4, 21, 0) },
  { employee_uid: 'seed-emp-ramesh', employee_id: 'VAGT-0007', employee_name: 'Ramesh Gowda',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(4), check_in: ts(4, 8, 50), check_out: ts(4, 20, 55) },
  { employee_uid: 'seed-emp-irfan',  employee_id: 'VAGT-0006', employee_name: 'Mohammad Irfan', site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(5), check_in: ts(5, 21, 5), check_out: ts(5, 23, 55) },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(5), check_in: ts(5, 8, 42), check_out: ts(5, 17, 10) },
  { employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(6), check_in: ts(6, 20, 50),check_out: ts(6, 23, 48) },
  { employee_uid: 'seed-emp-kavitha',employee_id: 'VAGT-0009', employee_name: 'Kavitha Nair',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D',  date: istDate(6), check_in: ts(6, 9, 8),  check_out: ts(6, 21, 0) },
  { employee_uid: 'seed-emp-priya',  employee_id: 'VAGT-0005', employee_name: 'Priya Lakshmi',  site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',              date: istDate(6), check_in: ts(6, 9, 0),  check_out: ts(6, 17, 30) },
];

// ── Leave requests (7) ────────────────────────────────────────────────────────

const LEAVE_REQUESTS = [
  {
    employee_uid: 'seed-emp-suresh', employee_id: 'VAGT-0002', employee_name: 'Suresh Babu',
    leave_type: 'sick', from_date: istDate(0), to_date: istDate(-2),
    reason: 'High fever and cold — doctor advised rest for 3 days.',
    status: 'pending', applied_at: ts(1, 10, 15),
  },
  {
    employee_uid: 'seed-emp-irfan', employee_id: 'VAGT-0006', employee_name: 'Mohammad Irfan',
    leave_type: 'casual', from_date: istDate(-3), to_date: istDate(-3),
    reason: 'Personal work — need to renew driving licence.',
    status: 'pending', applied_at: ts(2, 8, 30),
  },
  {
    employee_uid: 'seed-emp-meena', employee_id: 'VAGT-0003', employee_name: 'Meena Devi',
    leave_type: 'casual', from_date: istDate(-8), to_date: istDate(-8),
    reason: 'Family function — sister\'s engagement.',
    status: 'approved', applied_at: ts(10, 11, 0), reviewed_at: ts(9, 9, 30),
  },
  {
    employee_uid: 'seed-emp-ramesh', employee_id: 'VAGT-0007', employee_name: 'Ramesh Gowda',
    leave_type: 'earned', from_date: istDate(-14), to_date: istDate(-12),
    reason: 'Village visit — family emergency.',
    status: 'approved', applied_at: ts(16, 14, 0), reviewed_at: ts(15, 10, 15),
  },
  {
    employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',
    leave_type: 'sick', from_date: istDate(-20), to_date: istDate(-20),
    reason: 'Stomach infection.',
    status: 'approved', applied_at: ts(21, 7, 45), reviewed_at: ts(20, 9, 0),
  },
  {
    employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',
    leave_type: 'casual', from_date: istDate(-30), to_date: istDate(-30),
    reason: 'Child\'s school admission day.',
    status: 'rejected', applied_at: ts(31, 10, 0), reviewed_at: ts(30, 11, 30),
    reject_reason: 'Insufficient notice. Please apply at least 3 days in advance.',
  },
  {
    employee_uid: 'seed-emp-priya', employee_id: 'VAGT-0005', employee_name: 'Priya Lakshmi',
    leave_type: 'casual', from_date: istDate(-45), to_date: istDate(-44),
    reason: 'Home town visit — Onam festival.',
    status: 'approved', applied_at: ts(48, 9, 0), reviewed_at: ts(47, 10, 0),
  },
];

// ── Complaints (7) ────────────────────────────────────────────────────────────

const COMPLAINTS = [
  {
    client_uid: CL_DSMAX, client_name: 'DSMax Properties Pvt. Ltd.',
    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',
    subject: 'Gate left unmanned during peak entry hours',
    description: 'On 14th March between 9:00 AM and 9:45 AM, the main entry gate was completely unmanned. Multiple visitors and delivery personnel entered without being logged. This is a serious lapse. We expect 100% coverage at the gate especially between 8:30 AM and 10:00 AM.',
    status: 'open', priority: 'high',
    created_at: ts(1, 14, 30), updated_at: ts(1, 14, 30), admin_note: null,
  },
  {
    client_uid: CL_DSMAX, client_name: 'DSMax Properties Pvt. Ltd.',
    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',
    subject: 'Visitor log entries missing for past week',
    description: 'Our internal audit revealed that at least 12–15 visitor entries from 8th–12th March are not recorded in the physical register or in the system. This creates a security and liability gap. We need this resolved and a process audit conducted.',
    status: 'in_progress', priority: 'medium',
    created_at: ts(5, 10, 0), updated_at: ts(3, 16, 0),
    admin_note: 'Guard briefed. New SOP for visitor log shared. We are monitoring for the next 7 days and will report back.',
  },
  {
    client_uid: CL_BRIGADE, client_name: 'Brigade Enterprises Ltd.',
    site_id: SITE_BRIGADE, site_name: 'Brigade Gateway',
    subject: 'Guard on mobile phone during duty hours',
    description: 'Our CCTV footage from 11th March between 2 PM and 3 PM shows the guard at Gate 2 using a personal mobile phone for approximately 40 minutes continuously. This is against the agreed code of conduct.',
    status: 'resolved', priority: 'medium',
    created_at: ts(6, 11, 0), updated_at: ts(5, 14, 30),
    admin_note: 'Guard counselled and given written warning. Phone policy reiterated to entire team. No recurrence observed.',
  },
  {
    client_uid: CL_PRESTIGE, client_name: 'Prestige Estates Projects Ltd.',
    site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D',
    subject: 'Night guard sleeping on duty',
    description: 'At approximately 2:30 AM on 10th March, our facilities manager on a surprise check found the night guard asleep at the security cabin. This is completely unacceptable given the nature of our premises.',
    status: 'resolved', priority: 'high',
    created_at: ts(7, 9, 0), updated_at: ts(6, 11, 0),
    admin_note: 'Guard replaced with immediate effect. New guard deployed from 11th March. Deepak Singh assigned. No incidents since.',
  },
  {
    client_uid: CL_DSMAX, client_name: 'DSMax Properties Pvt. Ltd.',
    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',
    subject: 'Uniform not worn properly',
    description: 'Guard was seen on Monday without the VAGT uniform cap and without name badge. Clients and vendors expect a professional appearance.',
    status: 'resolved', priority: 'low',
    created_at: ts(12, 9, 0), updated_at: ts(11, 11, 30),
    admin_note: 'Spoken to the guard. Replacement cap and badge issued. Will not recur.',
  },
  {
    client_uid: CL_BRIGADE, client_name: 'Brigade Enterprises Ltd.',
    site_id: SITE_BRIGADE, site_name: 'Brigade Gateway',
    subject: 'Delay in incident reporting',
    description: 'A minor altercation between two vendors took place at Gate 1 on 5th March. We were not informed until the next morning. Incidents must be reported within 1 hour.',
    status: 'open', priority: 'medium',
    created_at: ts(11, 15, 0), updated_at: ts(11, 15, 0), admin_note: null,
  },
  {
    client_uid: CL_PRESTIGE, client_name: 'Prestige Estates Projects Ltd.',
    site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D',
    subject: 'Patrol rounds not being completed',
    description: 'The NFC patrol log shows only 2 out of 6 checkpoints were scanned during the night patrol on 8th and 9th March. We are paying for full coverage.',
    status: 'in_progress', priority: 'high',
    created_at: ts(8, 13, 0), updated_at: ts(7, 10, 0),
    admin_note: 'Reviewed with guard. Patrol schedule reconfirmed. Deepak Singh now covering all 6 checkpoints. Monitoring via NFC logs.',
  },
];

// ── Incidents (5) ─────────────────────────────────────────────────────────────

const INCIDENTS = [
  {
    employee_uid: 'seed-emp-ravi', employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',
    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',
    type: 'unauthorized_entry', severity: 'medium',
    description: 'Unknown person attempted to enter through the side gate at 10:15 PM claiming to be a vendor. Could not produce ID or delivery order. Turned away and gate locked. Management notified.',
    status: 'reported', submitted_at: ts(2, 22, 20),
  },
  {
    employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',
    site_id: SITE_BRIGADE, site_name: 'Brigade Gateway',
    type: 'altercation', severity: 'low',
    description: 'Minor verbal argument between two delivery drivers at the loading bay entrance over queue position. Resolved peacefully. Both parties left without further incident.',
    status: 'resolved', submitted_at: ts(11, 11, 35), resolved_at: ts(10, 9, 0),
  },
  {
    employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',
    site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D',
    type: 'suspicious_activity', severity: 'high',
    description: 'Observed unidentified vehicle (white Maruti Eeco, KA-03 series) circling the perimeter 3 times between 1:30 AM and 2:00 AM. Number plate partially obscured. Reported to police control room. Vehicle did not return.',
    status: 'escalated', submitted_at: ts(5, 2, 15),
  },
  {
    employee_uid: 'seed-emp-meena', employee_id: 'VAGT-0003', employee_name: 'Meena Devi',
    site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',
    type: 'medical', severity: 'medium',
    description: 'Visitor (elderly male, approximately 65 years) felt dizzy near the reception. First aid administered. Family called. Visitor stable and escorted to car. Ambulance not required.',
    status: 'resolved', submitted_at: ts(9, 14, 45), resolved_at: ts(9, 16, 0),
  },
  {
    employee_uid: 'seed-emp-irfan', employee_id: 'VAGT-0006', employee_name: 'Mohammad Irfan',
    site_id: SITE_BRIGADE, site_name: 'Brigade Gateway',
    type: 'theft_attempt', severity: 'high',
    description: 'Contract worker found attempting to remove a laptop from the 3rd floor office area at 11:45 PM. Intercepted at parking exit. Item returned. Police called. FIR filed. Worker detained for questioning.',
    status: 'escalated', submitted_at: ts(14, 23, 50),
  },
];

// ── Guest logs (12) ───────────────────────────────────────────────────────────

const GUESTS = [
  { site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', client_uid: CL_DSMAX, guard_uid: 'seed-emp-ravi', guard_name: 'Ravi Kumar', visitor_name: 'Amit Verma', visitor_phone: '9845123456', visitor_company: 'Infosys Ltd.', purpose: 'Meeting', host_name: 'Rohan Mehta', vehicle_number: 'KA-01-MF-4521', check_in: ts(0, 9, 35), check_out: ts(0, 11, 10) },
  { site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', client_uid: CL_DSMAX, guard_uid: 'seed-emp-ravi', guard_name: 'Ravi Kumar', visitor_name: 'Sunitha Rao', visitor_phone: '9741234567', visitor_company: 'Accenture', purpose: 'Interview', host_name: 'HR Department', vehicle_number: null, check_in: ts(0, 10, 15), check_out: ts(0, 12, 0) },
  { site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', client_uid: CL_DSMAX, guard_uid: 'seed-emp-meena', guard_name: 'Meena Devi', visitor_name: 'Blue Dart Courier', visitor_phone: '8884567890', visitor_company: 'Blue Dart', purpose: 'Delivery', host_name: 'Admin Desk', vehicle_number: 'KA-03-EN-7123', check_in: ts(1, 14, 20), check_out: ts(1, 14, 45) },
  { site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', client_uid: CL_DSMAX, guard_uid: 'seed-emp-ravi', guard_name: 'Ravi Kumar', visitor_name: 'Kiran Bhat', visitor_phone: '9986540012', visitor_company: 'Wipro Technologies', purpose: 'Client Visit', host_name: 'DSMax Management', vehicle_number: 'KA-01-AB-1234', check_in: ts(1, 11, 0), check_out: ts(1, 13, 30) },
  { site_id: SITE_BRIGADE, site_name: 'Brigade Gateway', client_uid: CL_BRIGADE, guard_uid: 'seed-emp-venkat', guard_name: 'Venkatesh Reddy', visitor_name: 'Pradeep Kumar', visitor_phone: '9880334455', visitor_company: 'Tata Consultancy Services', purpose: 'Meeting', host_name: 'Sunita Nair', vehicle_number: 'KA-04-MK-9901', check_in: ts(0, 10, 30), check_out: null },
  { site_id: SITE_BRIGADE, site_name: 'Brigade Gateway', client_uid: CL_BRIGADE, guard_uid: 'seed-emp-venkat', guard_name: 'Venkatesh Reddy', visitor_name: 'Asha Williams', visitor_phone: '9845778899', visitor_company: 'CBRE India', purpose: 'Facilities Audit', host_name: 'Facilities Team', vehicle_number: 'KA-02-BC-5566', check_in: ts(0, 9, 0), check_out: ts(0, 16, 45) },
  { site_id: SITE_BRIGADE, site_name: 'Brigade Gateway', client_uid: CL_BRIGADE, guard_uid: 'seed-emp-priya', guard_name: 'Priya Lakshmi', visitor_name: 'Zepto Delivery', visitor_phone: '8792345678', visitor_company: 'Zepto', purpose: 'Delivery', host_name: 'Reception', vehicle_number: 'KA-05-DE-2244', check_in: ts(1, 12, 50), check_out: ts(1, 13, 5) },
  { site_id: SITE_BRIGADE, site_name: 'Brigade Gateway', client_uid: CL_BRIGADE, guard_uid: 'seed-emp-priya', guard_name: 'Priya Lakshmi', visitor_name: 'Nikhil Jha', visitor_phone: '9008877711', visitor_company: 'VAGT Security Services', purpose: 'Management Visit', host_name: 'Sunita Nair', vehicle_number: 'KA-01-NJ-7777', check_in: ts(3, 10, 0), check_out: ts(3, 12, 30) },
  { site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D', client_uid: CL_PRESTIGE, guard_uid: 'seed-emp-ramesh', guard_name: 'Ramesh Gowda', visitor_name: 'Sanjay Mehta', visitor_phone: '9741890012', visitor_company: 'Microsoft India', purpose: 'Conference', host_name: 'Arvind Krishnan', vehicle_number: 'KA-01-SM-3344', check_in: ts(0, 9, 15), check_out: null },
  { site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D', client_uid: CL_PRESTIGE, guard_uid: 'seed-emp-ramesh', guard_name: 'Ramesh Gowda', visitor_name: 'Lalitha Krishnaswamy', visitor_phone: '9886112233', visitor_company: 'Amazon India', purpose: 'Interview', host_name: 'HR — Prestige', vehicle_number: null, check_in: ts(2, 11, 30), check_out: ts(2, 13, 0) },
  { site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D', client_uid: CL_PRESTIGE, guard_uid: 'seed-emp-kavitha', guard_name: 'Kavitha Nair', visitor_name: 'Fire Safety Inspector', visitor_phone: '9480012345', visitor_company: 'Karnataka Fire Force', purpose: 'Inspection', host_name: 'Admin Team', vehicle_number: 'KA-GV-1001', check_in: ts(4, 10, 0), check_out: ts(4, 12, 45) },
  { site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D', client_uid: CL_PRESTIGE, guard_uid: 'seed-emp-kavitha', guard_name: 'Kavitha Nair', visitor_name: 'Rajesh Patel', visitor_phone: '9845990011', visitor_company: 'Sodexo FM', purpose: 'Facilities Management', host_name: 'Arvind Krishnan', vehicle_number: 'KA-03-RP-4455', check_in: ts(5, 14, 0), check_out: ts(5, 16, 30) },
];

// ── Patrol checkpoints (6) ────────────────────────────────────────────────────

const PATROL_CHECKPOINTS = [
  { id: 'seed-cp-prestige-main',  site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',          name: 'Main Entrance Gate',   nfc_tag_id: 'NFC-PTP-001', location_hint: 'Near reception lobby', active: true, created_at: d(90) },
  { id: 'seed-cp-prestige-back',  site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',          name: 'Rear Service Gate',    nfc_tag_id: 'NFC-PTP-002', location_hint: 'Loading bay, south side', active: true, created_at: d(90) },
  { id: 'seed-cp-prestige-car',   site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park',          name: 'Basement Parking B2',  nfc_tag_id: 'NFC-PTP-003', location_hint: 'B2 level stairwell', active: true, created_at: d(90) },
  { id: 'seed-cp-brigade-gate1',  site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',             name: 'Gate 1 — Main',        nfc_tag_id: 'NFC-BRG-001', location_hint: 'Dr. Rajkumar Road entrance', active: true, created_at: d(60) },
  { id: 'seed-cp-manyata-blockd', site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D', name: 'Block D North Entry',  nfc_tag_id: 'NFC-MNY-001', location_hint: 'North gate, near cafeteria', active: true, created_at: d(45) },
  { id: 'seed-cp-manyata-park',   site_id: SITE_MANYATA,  site_name: 'Manyata Tech Park — Block D', name: 'Visitor Parking P3',   nfc_tag_id: 'NFC-MNY-002', location_hint: 'P3 level, column 12', active: true, created_at: d(45) },
];

// ── Patrol logs (10) ──────────────────────────────────────────────────────────

const PATROL_LOGS = [
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',    site_id: SITE_PRESTIGE, checkpoint_id: 'seed-cp-prestige-main', checkpoint_name: 'Main Entrance Gate',  scanned_at: ts(0, 10, 0) },
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',    site_id: SITE_PRESTIGE, checkpoint_id: 'seed-cp-prestige-back', checkpoint_name: 'Rear Service Gate',   scanned_at: ts(0, 10, 18) },
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',    site_id: SITE_PRESTIGE, checkpoint_id: 'seed-cp-prestige-car',  checkpoint_name: 'Basement Parking B2', scanned_at: ts(0, 10, 34) },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',    site_id: SITE_PRESTIGE, checkpoint_id: 'seed-cp-prestige-main', checkpoint_name: 'Main Entrance Gate',  scanned_at: ts(1, 14, 5) },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',    site_id: SITE_PRESTIGE, checkpoint_id: 'seed-cp-prestige-back', checkpoint_name: 'Rear Service Gate',   scanned_at: ts(1, 14, 22) },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE, checkpoint_id: 'seed-cp-brigade-gate1', checkpoint_name: 'Gate 1 — Main',       scanned_at: ts(0, 11, 0) },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',site_id: SITE_BRIGADE, checkpoint_id: 'seed-cp-brigade-gate1', checkpoint_name: 'Gate 1 — Main',       scanned_at: ts(1, 10, 58) },
  { employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',  site_id: SITE_MANYATA,  checkpoint_id: 'seed-cp-manyata-blockd',checkpoint_name: 'Block D North Entry',  scanned_at: ts(1, 22, 10) },
  { employee_uid: 'seed-emp-deepak', employee_id: 'VAGT-0008', employee_name: 'Deepak Singh',  site_id: SITE_MANYATA,  checkpoint_id: 'seed-cp-manyata-park',  checkpoint_name: 'Visitor Parking P3',   scanned_at: ts(1, 22, 28) },
  { employee_uid: 'seed-emp-ramesh', employee_id: 'VAGT-0007', employee_name: 'Ramesh Gowda',  site_id: SITE_MANYATA,  checkpoint_id: 'seed-cp-manyata-blockd',checkpoint_name: 'Block D North Entry',  scanned_at: ts(0, 10, 5) },
];

// ── Payslips (5 — March 2026) ─────────────────────────────────────────────────

const PAYSLIPS = [
  { employee_uid: 'seed-emp-ravi',   employee_id: 'VAGT-0001', employee_name: 'Ravi Kumar',    month: '2026-02', basic: 14000, hra: 3500, allowances: 1500, overtime_hrs: 8,  overtime_pay: 933,  deductions: { pf: 1680, esic: 245 }, net_pay: 18008, days_worked: 26, status: 'paid', paid_at: d(14) },
  { employee_uid: 'seed-emp-suresh', employee_id: 'VAGT-0002', employee_name: 'Suresh Babu',   month: '2026-02', basic: 14000, hra: 3500, allowances: 1500, overtime_hrs: 4,  overtime_pay: 467,  deductions: { pf: 1680, esic: 245 }, net_pay: 17542, days_worked: 25, status: 'paid', paid_at: d(14) },
  { employee_uid: 'seed-emp-meena',  employee_id: 'VAGT-0003', employee_name: 'Meena Devi',    month: '2026-02', basic: 14000, hra: 3500, allowances: 1500, overtime_hrs: 6,  overtime_pay: 700,  deductions: { pf: 1680, esic: 245 }, net_pay: 17775, days_worked: 26, status: 'paid', paid_at: d(14) },
  { employee_uid: 'seed-emp-venkat', employee_id: 'VAGT-0004', employee_name: 'Venkatesh Reddy',month: '2026-02', basic: 16000, hra: 4000, allowances: 2000, overtime_hrs: 10, overtime_pay: 1333, deductions: { pf: 1920, esic: 279 }, net_pay: 21134, days_worked: 27, status: 'paid', paid_at: d(14) },
  { employee_uid: 'seed-emp-priya',  employee_id: 'VAGT-0005', employee_name: 'Priya Lakshmi', month: '2026-02', basic: 14000, hra: 3500, allowances: 1500, overtime_hrs: 0,  overtime_pay: 0,    deductions: { pf: 1680, esic: 245 }, net_pay: 17075, days_worked: 24, status: 'paid', paid_at: d(14) },
];

// ── Invoices (4) ──────────────────────────────────────────────────────────────

const INVOICES = [
  { client_uid: CL_DSMAX, client_name: 'DSMax Properties Pvt. Ltd.', site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', invoice_number: 'VAGT-INV-2026-031', month: '2026-02', amount: 87500, tax_amount: 15750, total: 103250, status: 'paid', issued_at: d(14), due_date: d(0), paid_at: d(5) },
  { client_uid: CL_BRIGADE, client_name: 'Brigade Enterprises Ltd.',  site_id: SITE_BRIGADE,  site_name: 'Brigade Gateway',    invoice_number: 'VAGT-INV-2026-032', month: '2026-02', amount: 65000, tax_amount: 11700, total: 76700,  status: 'paid', issued_at: d(14), due_date: d(0), paid_at: d(3) },
  { client_uid: CL_PRESTIGE,client_name: 'Prestige Estates Projects Ltd.', site_id: SITE_MANYATA, site_name: 'Manyata Tech Park — Block D', invoice_number: 'VAGT-INV-2026-033', month: '2026-02', amount: 65000, tax_amount: 11700, total: 76700, status: 'pending', issued_at: d(14), due_date: d(-1) },
  { client_uid: CL_DSMAX, client_name: 'DSMax Properties Pvt. Ltd.', site_id: SITE_PRESTIGE, site_name: 'Prestige Tech Park', invoice_number: 'VAGT-INV-2026-021', month: '2026-01', amount: 87500, tax_amount: 15750, total: 103250, status: 'paid', issued_at: d(45), due_date: d(30), paid_at: d(28) },
];

// ── Activity log (20) ─────────────────────────────────────────────────────────

const ACTIVITY = [
  { type: 'check_in',       description: 'Ravi Kumar checked in at Prestige Tech Park',         actor: 'VAGT-0001', created_at: ts(0, 8, 52) },
  { type: 'check_in',       description: 'Meena Devi checked in at Prestige Tech Park',         actor: 'VAGT-0003', created_at: ts(0, 9, 3) },
  { type: 'check_in',       description: 'Venkatesh Reddy checked in at Brigade Gateway',       actor: 'VAGT-0004', created_at: ts(0, 8, 45) },
  { type: 'check_in',       description: 'Priya Lakshmi checked in at Brigade Gateway',         actor: 'VAGT-0005', created_at: ts(0, 9, 10) },
  { type: 'check_in',       description: 'Ramesh Gowda checked in at Manyata Tech Park',        actor: 'VAGT-0007', created_at: ts(0, 8, 58) },
  { type: 'leave_request',  description: 'Suresh Babu submitted sick leave request',            actor: 'VAGT-0002', created_at: ts(1, 10, 15) },
  { type: 'leave_request',  description: 'Mohammad Irfan submitted casual leave request',       actor: 'VAGT-0006', created_at: ts(2, 8, 30) },
  { type: 'complaint',      description: 'New complaint: Gate left unmanned — DSMax',           actor: CL_DSMAX, created_at: ts(1, 14, 30) },
  { type: 'complaint',      description: 'Complaint updated: Patrol rounds not completed — Prestige', actor: 'admin', created_at: ts(7, 10, 0) },
  { type: 'incident',       description: 'Incident filed: Suspicious vehicle at Manyata — Deepak Singh', actor: 'VAGT-0008', created_at: ts(5, 2, 20) },
  { type: 'incident',       description: 'Incident filed: Theft attempt at Brigade — Irfan',    actor: 'VAGT-0006', created_at: ts(14, 23, 52) },
  { type: 'patrol',         description: 'Patrol completed: Ravi Kumar — 3/3 checkpoints',      actor: 'VAGT-0001', created_at: ts(0, 10, 35) },
  { type: 'patrol',         description: 'Patrol completed: Venkatesh Reddy — 1/1 checkpoint', actor: 'VAGT-0004', created_at: ts(0, 11, 1) },
  { type: 'check_out',      description: 'Suresh Babu checked out — 12h 05m on duty',           actor: 'VAGT-0002', created_at: ts(1, 23, 59) },
  { type: 'check_out',      description: 'Meena Devi checked out — 12h 05m on duty',            actor: 'VAGT-0003', created_at: ts(1, 21, 5) },
  { type: 'leave_approved', description: 'Leave approved: Meena Devi — casual 1 day',          actor: 'admin', created_at: ts(9, 9, 30) },
  { type: 'leave_approved', description: 'Leave approved: Venkatesh Reddy — sick 1 day',       actor: 'admin', created_at: ts(20, 9, 0) },
  { type: 'invoice',        description: 'Invoice VAGT-INV-2026-031 marked paid — DSMax ₹1,03,250', actor: 'admin', created_at: ts(5, 11, 0) },
  { type: 'invoice',        description: 'Invoice VAGT-INV-2026-032 marked paid — Brigade ₹76,700', actor: 'admin', created_at: ts(3, 14, 0) },
  { type: 'registration',   description: 'New employee registered: Kavitha Nair — pending approval', actor: 'system', created_at: ts(40, 10, 0) },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function wipeAll() {
  console.log('Wiping all seed data…');
  const collections = [
    'employees', 'attendance_logs', 'leave_requests', 'complaints',
    'incidents', 'sites', 'companies', 'activity_log',
    'guest_logs', 'patrol_checkpoints', 'patrol_logs', 'payslips', 'invoices',
  ];
  for (const col of collections) {
    const snap = await db.collection(col).where('_seed', '==', true).get();
    if (snap.empty) { console.log(`  (empty) ${col}`); continue; }
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  🗑  deleted ${snap.size} from ${col}`);
  }
  console.log('\nDone.');
}

async function seedAll() {
  console.log('Seeding VAGT demo data…\n');

  // ── Resolve real Firebase Auth UIDs for test accounts ─────────────────────
  // create-test-users.js must be run before seed-demo-data.js.
  // This maps seed placeholder IDs → real Auth UIDs so that portal queries
  // (which filter by the logged-in user's UID) return actual data.
  const uidMap = {};
  const testAccounts = [
    { seedId: 'seed-emp-ravi',         email: 'guard001@vagttest.com' },
    { seedId: 'seed-emp-suresh',       email: 'guard002@vagttest.com' },
    { seedId: 'seed-client-dsmax-001', email: 'client001@vagttest.com' },
  ];
  for (const { seedId, email } of testAccounts) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      uidMap[seedId] = u.uid;
      console.log(`  🔗 ${seedId} → ${u.uid} (${email})`);
    } catch {
      console.log(`  ⚠️  ${email} not found — run create-test-users.js first`);
    }
  }
  // Returns real UID if mapped, otherwise keeps the seed placeholder
  const r = (id) => (id && uidMap[id]) ? uidMap[id] : id;

  // Companies
  for (const co of COMPANIES) {
    const { id, ...data } = co;
    await db.collection('companies').doc(id).set({ ...data, _seed: true });
    console.log('  ✅ company:', co.name);
  }

  // Sites
  for (const site of SITES) {
    const { id, ...data } = site;
    await db.collection('sites').doc(id).set({ ...data, _seed: true });
    console.log('  ✅ site:', site.name);
  }

  // Employees — use real Auth UID as doc ID for test accounts so the portal
  // finds the right document when querying by firebase.auth().currentUser.uid
  for (const emp of EMPLOYEES) {
    const { id, ...data } = emp;
    const docId = r(id);
    await db.collection('employees').doc(docId).set({
      ...data,
      uid: docId,
      _seed: true,
    });
    console.log('  ✅ employee:', emp.name, `(${emp.employee_id})`, docId !== id ? `→ real UID` : '');
  }

  // Attendance — real employee_uid for test guards
  for (let i = 0; i < ATTENDANCE.length; i++) {
    const log = ATTENDANCE[i];
    const docId = `seed-att-${log.employee_id}-${log.date || i}`;
    await db.collection('attendance_logs').doc(docId).set({
      ...log,
      employee_uid: r(log.employee_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ attendance logs: ${ATTENDANCE.length}`);

  // Leave requests — real employee_uid for test guards
  for (let i = 0; i < LEAVE_REQUESTS.length; i++) {
    const lr = LEAVE_REQUESTS[i];
    const docId = `seed-lr-${lr.employee_id}-${lr.from_date || i}`;
    await db.collection('leave_requests').doc(docId).set({
      ...lr,
      employee_uid: r(lr.employee_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ leave requests: ${LEAVE_REQUESTS.length}`);

  // Complaints — real client_uid for test client
  for (let i = 0; i < COMPLAINTS.length; i++) {
    const c = COMPLAINTS[i];
    const docId = `seed-cmp-${c.client_uid || 'unknown'}-${i + 1}`;
    await db.collection('complaints').doc(docId).set({
      ...c,
      client_uid: r(c.client_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ complaints: ${COMPLAINTS.length}`);

  // Incidents — real employee_uid where present
  for (let i = 0; i < INCIDENTS.length; i++) {
    const inc = INCIDENTS[i];
    const docId = `seed-inc-${(inc.type || 'other').replace(/[^a-z0-9]/g, '_')}-${i + 1}`;
    await db.collection('incidents').doc(docId).set({
      ...inc,
      ...(inc.employee_uid && { employee_uid: r(inc.employee_uid) }),
      ...(inc.guard_uid    && { guard_uid:    r(inc.guard_uid)    }),
      ...(inc.reported_by  && { reported_by:  r(inc.reported_by)  }),
      _seed: true,
    });
  }
  console.log(`  ✅ incidents: ${INCIDENTS.length}`);

  // Guest logs — real guard_uid and client_uid
  for (let i = 0; i < GUESTS.length; i++) {
    const g = GUESTS[i];
    const docId = `seed-guest-${g.site_id || 'unknown'}-${i + 1}`;
    await db.collection('guest_logs').doc(docId).set({
      ...g,
      guard_uid:  r(g.guard_uid),
      client_uid: r(g.client_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ guest logs: ${GUESTS.length}`);

  // Patrol checkpoints — already use explicit IDs
  for (const cp of PATROL_CHECKPOINTS) {
    const { id, ...data } = cp;
    await db.collection('patrol_checkpoints').doc(id).set({ ...data, _seed: true });
  }
  console.log(`  ✅ patrol checkpoints: ${PATROL_CHECKPOINTS.length}`);

  // Patrol logs — real guard_uid where present
  for (let i = 0; i < PATROL_LOGS.length; i++) {
    const pl = PATROL_LOGS[i];
    const docId = `seed-pl-${pl.checkpoint_id || 'unknown'}-${i + 1}`;
    await db.collection('patrol_logs').doc(docId).set({
      ...pl,
      ...(pl.guard_uid    && { guard_uid:    r(pl.guard_uid)    }),
      ...(pl.employee_uid && { employee_uid: r(pl.employee_uid) }),
      _seed: true,
    });
  }
  console.log(`  ✅ patrol logs: ${PATROL_LOGS.length}`);

  // Payslips — real employee_uid for test guards
  for (let i = 0; i < PAYSLIPS.length; i++) {
    const ps = PAYSLIPS[i];
    const docId = `seed-pay-${ps.employee_id}-${(ps.month || i).replace('/', '-')}`;
    await db.collection('payslips').doc(docId).set({
      ...ps,
      employee_uid: r(ps.employee_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ payslips: ${PAYSLIPS.length}`);

  // Invoices — real client_uid for test client
  for (let i = 0; i < INVOICES.length; i++) {
    const inv = INVOICES[i];
    const docId = `seed-inv-${(inv.invoice_number || i).replace(/[^a-zA-Z0-9-]/g, '-')}`;
    await db.collection('invoices').doc(docId).set({
      ...inv,
      client_uid: r(inv.client_uid),
      _seed: true,
    });
  }
  console.log(`  ✅ invoices: ${INVOICES.length}`);

  // Activity log — deterministic ID: seed-act-{i}
  for (let i = 0; i < ACTIVITY.length; i++) {
    const a = ACTIVITY[i];
    await db.collection('activity_log').doc(`seed-act-${i + 1}`).set({ ...a, _seed: true });
  }
  console.log(`  ✅ activity log: ${ACTIVITY.length}`);

  const total = COMPANIES.length + SITES.length + EMPLOYEES.length +
    ATTENDANCE.length + LEAVE_REQUESTS.length + COMPLAINTS.length +
    INCIDENTS.length + GUESTS.length + PATROL_CHECKPOINTS.length +
    PATROL_LOGS.length + PAYSLIPS.length + INVOICES.length + ACTIVITY.length;

  console.log(`\n✅ Done — ${total} documents seeded across 13 collections.`);
  console.log('   Refresh the admin dashboard to see live data.');
  console.log('   To wipe:  node seed-demo-data.js <key.json> --wipe\n');
  console.log('Real data used where known:');
  console.log('  Locations: Prestige Tech Park ORR, Brigade Gateway Rajajinagar, Manyata Tech Park Nagawara');
  console.log('  Client: DSMax Properties (real client), Brigade Group, Prestige Group');
  console.log('  VAGT phone: +91 90088 77711  |  email: info@vagtservices.com');
}

// ── Run ───────────────────────────────────────────────────────────────────────

(WIPE ? wipeAll() : seedAll()).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
