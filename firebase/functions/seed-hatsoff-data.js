/**
 * seed-hatsoff-data.js
 * Seeds Firestore with 33 months of real HatsOff Aviation guard rota data
 * (May 2023 – Jan 2026) extracted from client-briefs/vagt-rota-2026.xlsx
 *
 * Usage:
 *   node firebase/functions/seed-hatsoff-data.js /path/to/service-account-key.json
 *
 * What it creates:
 *   • 1 company doc   — HatsOff Aviation
 *   • 1 site doc      — HatsOff Aviation, Bengaluru
 *   • 22 employee docs — real guards with actual clock numbers & designations
 *   • ~9,000 attendance_log docs — daily P/L/W/O records with realistic IST timestamps
 *   • 33 × guard payslip docs — monthly day/OT summaries
 */

'use strict';

const admin   = require('firebase-admin');
const XLSX    = require('xlsx');
const path    = require('path');
const crypto  = require('crypto');

// ─── Init ────────────────────────────────────────────────────────────────────
const keyFile = process.argv[2];
if (!keyFile) {
  console.error('Usage: node seed-hatsoff-data.js /path/to/service-account-key.json');
  process.exit(1);
}

const serviceAccount = require(path.resolve(keyFile));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Config ──────────────────────────────────────────────────────────────────
const ROTA_FILE  = path.resolve(__dirname, '../../client-briefs/vagt-rota-2026.xlsx');
const SITE_NAME  = 'HatsOff Aviation';
const SITE_ID    = 'site_hatsoff_aviation';
const COMPANY_ID = 'company_hatsoff_aviation';
const CLIENT_ID  = 'client_hatsoff_aviation';

// ─── Canonical guard roster (source of truth) ────────────────────────────────
// Keyed by CLK number. Where a CLK slot was reused by different people over time,
// we create separate records (clk_slot_person tracks the individual).
// Active guards = those present in the Jan-26 muster roll.
const CANONICAL_ROSTER = {
  // ── Currently active (Jan-26) ──────────────────────────────────────────────
  '321': {
    canonical_name: 'Lal Singh K',    raw_names: ['LAL SINGH K'],
    desig_code: 'SO',  designation: 'Security Officer',
    role_family: 'security',          grade: 'Security Officer',
    vagt_id: 'VAGT-0001',             supervisor_tier: true,
    status: 'active',
  },
  '427': {
    canonical_name: 'Abhilash BR',    raw_names: ['ABHILASH BR'],
    desig_code: 'FO',  designation: 'Fire Officer',
    role_family: 'security',          grade: 'Fire Officer',
    vagt_id: 'VAGT-0002',
    status: 'active',
  },
  '454': {
    canonical_name: 'Sandeep S',      raw_names: ['SANDEEP S'],
    desig_code: 'FO',  designation: 'Fire Officer',
    role_family: 'security',          grade: 'Fire Officer',
    vagt_id: 'VAGT-0003',
    status: 'active',
  },
  '868': {
    canonical_name: 'Arnab Nandi',    raw_names: ['ARNAB NANDI', 'ARNAV NANDI', 'A NANDI'],
    desig_code: 'FO',  designation: 'Fire Officer',
    role_family: 'security',          grade: 'Fire Officer',
    vagt_id: 'VAGT-0004',
    status: 'active',
  },
  '8': {
    canonical_name: 'Kempa Raju',     raw_names: ['KEMPA RAJU'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0005',
    status: 'active',
  },
  '813': {
    // Same person as CLK 8 — old CLK number (KEMPA RAJU). Historical only.
    canonical_name: 'Kempa Raju',     raw_names: ['KEMPA RAJU'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0005',             // same VAGT ID — same person
    status: 'historical',
  },
  '9': {
    canonical_name: 'Vikram BV',      raw_names: ['VIKRAM BV', 'VIKRAM'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0006',
    status: 'active',
  },
  '98': {
    canonical_name: 'Sambhu Manna',   raw_names: ['SAMBHU MANNA'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0007',
    status: 'active',
  },
  '285_arumugam': {
    canonical_name: 'Arumugam',       raw_names: ['ARUMUGAM'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0008',             clk_no: '285',
    status: 'active',
  },
  '439_prashanta': {
    canonical_name: 'Prashanta Behra', raw_names: ['PRASHANTA BEHRA', 'PRASHANTA B'],
    desig_code: 'SG',  designation: 'Security Guard Grade-II',
    role_family: 'security',           grade: 'Security Guard Grade-II',
    vagt_id: 'VAGT-0009',              clk_no: '439',
    status: 'active',
  },
  '799': {
    canonical_name: 'Mohan Raj P',    raw_names: ['MOHAN RAJ P'],
    desig_code: 'SG',  designation: 'Additional Security Guard',
    role_family: 'security',          grade: 'Additional Security Guard',
    vagt_id: 'VAGT-0010',
    status: 'active',
  },
  // ── Historical / departed guards ──────────────────────────────────────────
  '7': {
    canonical_name: 'Shree Kumar',    raw_names: ['SHREE KUMAR'],
    desig_code: 'FO',  designation: 'Fire Officer',
    role_family: 'security',          grade: 'Fire Officer',
    vagt_id: 'VAGT-0011',
    status: 'inactive',
  },
  '245': {
    canonical_name: 'Suresh',         raw_names: ['SURESH'],
    desig_code: 'FO',  designation: 'Fire Officer',
    role_family: 'security',          grade: 'Fire Officer',
    vagt_id: 'VAGT-0012',
    status: 'inactive',
  },
  '16_hussain': {
    canonical_name: 'Hussain Saikh',  raw_names: ['HUSSAIN SAIKH'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0013',             clk_no: '16',
    status: 'inactive',
  },
  '16_subesh': {
    canonical_name: 'Subesh Mandal',  raw_names: ['SUBESH MANDAL'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0014',             clk_no: '16',
    status: 'inactive',
  },
  '285_ranjan': {
    canonical_name: 'Ranjan Barik',   raw_names: ['RANJAN BARIK'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0015',             clk_no: '285',
    status: 'inactive',
  },
  '439_goutam': {
    canonical_name: 'Goutam Mallick', raw_names: ['GOUTAM MALLICK'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0016',             clk_no: '439',
    status: 'inactive',
  },
  '429': {
    canonical_name: 'Sanjiv Kumar',   raw_names: ['SANJIV KUMAR'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0017',
    status: 'inactive',
  },
  'joytirmoy': {
    canonical_name: 'Joytirmoy',      raw_names: ['JOYTIRMOY'],
    desig_code: 'SG',  designation: 'Security Guard Grade-I',
    role_family: 'security',          grade: 'Security Guard Grade-I',
    vagt_id: 'VAGT-0018',             clk_no: null,
    status: 'inactive',
  },
};

// Reverse map: raw name → roster key (for attendance log attribution)
const RAW_NAME_TO_KEY = {};
Object.entries(CANONICAL_ROSTER).forEach(([key, g]) => {
  g.raw_names.forEach(n => {
    // Don't overwrite if already mapped (prefer active/later record)
    if (!RAW_NAME_TO_KEY[n] || g.status === 'active') RAW_NAME_TO_KEY[n] = key;
  });
});

// Sheet name → { year, month (1-12) }
const SHEET_MONTH_MAP = {
  'MAY-23': { year: 2023, month: 5  },
  'Jun-23': { year: 2023, month: 6  },
  ' Jul-23':{ year: 2023, month: 7  },
  'AUG-23': { year: 2023, month: 8  },
  'SEP-23': { year: 2023, month: 9  },
  'OCT-23': { year: 2023, month: 10 },
  'NOV 23': { year: 2023, month: 11 },
  'DEC-23': { year: 2023, month: 12 },
  'JAN-24': { year: 2024, month: 1  },
  ' FEB -24':{ year: 2024, month: 2 },
  'MAR-24': { year: 2024, month: 3  },
  'APR-24': { year: 2024, month: 4  },
  'MAY-24': { year: 2024, month: 5  },
  'JUN-24': { year: 2024, month: 6  },
  'JUL-24': { year: 2024, month: 7  },
  'AUG-24': { year: 2024, month: 8  },
  'SEP-24': { year: 2024, month: 9  },
  'OCT-24': { year: 2024, month: 10 },
  'NOV-24': { year: 2024, month: 11 },
  'DEC-24': { year: 2024, month: 12 },
  'JAN-25': { year: 2025, month: 1  },
  'FEB-25': { year: 2025, month: 2  },
  'MAR-25': { year: 2025, month: 3  },
  'APR-25': { year: 2025, month: 4  },
  'May-25': { year: 2025, month: 5  },
  'Jun-25': { year: 2025, month: 6  },
  'Jul-25': { year: 2025, month: 7  },
  'AUG-25': { year: 2025, month: 8  },
  'Sep-25': { year: 2025, month: 9  },
  'Oct-25': { year: 2025, month: 10 },
  'Nov-25': { year: 2025, month: 11 },
  'Dec-25': { year: 2025, month: 12 },
  'Jan-26': { year: 2026, month: 1  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Stable Firestore doc ID from VAGT employee ID (e.g. "VAGT-0001" → "emp_vagt_0001") */
function empDocId(vagtId) {
  return 'emp_' + vagtId.toLowerCase().replace('-', '_');
}

/** Resolve a raw name from the rota to a roster key */
function resolveRosterKey(rawName, clkNo) {
  const upper = rawName.trim().toUpperCase();
  // Try CLK-based lookup first (most reliable)
  const clkStr = String(clkNo);
  if (CANONICAL_ROSTER[clkStr]) return clkStr;
  // CLK slots reused — try active person first, then inactive
  const clkActive = Object.keys(CANONICAL_ROSTER).find(k =>
    (CANONICAL_ROSTER[k].clk_no === clkStr || k.startsWith(clkStr + '_')) &&
    CANONICAL_ROSTER[k].status === 'active'
  );
  if (clkActive) return clkActive;
  const clkAny = Object.keys(CANONICAL_ROSTER).find(k =>
    CANONICAL_ROSTER[k].clk_no === clkStr || k.startsWith(clkStr + '_')
  );
  if (clkAny) return clkAny;
  // Fall back to name matching
  return RAW_NAME_TO_KEY[upper] || null;
}

/** Random int between min and max inclusive */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Build an IST timestamp for a given date + hour + minute */
function istTimestamp(year, month, day, hour, minute) {
  // IST = UTC + 5:30. So to get UTC: subtract 5h30m
  const utcMs = Date.UTC(year, month - 1, day, hour - 5, minute - 30);
  return admin.firestore.Timestamp.fromMillis(utcMs);
}

/** Format date as YYYY-MM-DD */
function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/** Days in a month */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Write in batches of 400 */
async function commitBatch(ops) {
  const SIZE = 400;
  for (let i = 0; i < ops.length; i += SIZE) {
    const batch = db.batch();
    ops.slice(i, i + SIZE).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
    process.stdout.write(`  committed ${Math.min(i + SIZE, ops.length)}/${ops.length}\r`);
  }
  process.stdout.write('\n');
}

// ─── Parse Rota ──────────────────────────────────────────────────────────────
function parseRota() {
  const wb = XLSX.readFile(ROTA_FILE);
  // months → attendance rows only; employee docs come from CANONICAL_ROSTER
  const months = [];

  for (const sheetName of wb.SheetNames) {
    const ym = SHEET_MONTH_MAP[sheetName];
    if (!ym) { console.warn(`  skipping unmapped sheet: "${sheetName}"`); continue; }

    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const monthRows = [];

    for (const row of data) {
      const sn   = row[0];
      const clNo = row[1];
      const name = row[3];
      if (!Number.isInteger(sn) || !name || typeof name !== 'string') continue;
      if (name.trim() === 'DESIG') continue;

      const clkStr     = clNo != null ? String(Math.round(clNo)) : null;
      const rosterKey  = resolveRosterKey(name.trim().toUpperCase(), clkStr || '');
      if (!rosterKey) {
        console.warn(`  ⚠ unresolved guard: "${name.trim()}" CLK=${clkStr} (${sheetName})`);
        continue;
      }
      const guard = CANONICAL_ROSTER[rosterKey];
      const docId = empDocId(guard.vagt_id);

      const dayVals    = row.slice(4, 35).map(v => v === null ? null : String(v).trim());
      const daysWorked = typeof row[35] === 'number' ? row[35] : null;
      const ot         = typeof row[36] === 'number' ? row[36] : 0;

      monthRows.push({
        docId,
        vagtId:       guard.vagt_id,
        name:         guard.canonical_name,
        days:         dayVals,
        daysWorked,
        ot,
      });
    }

    months.push({ year: ym.year, month: ym.month, sheetName, rows: monthRows });
  }

  return { months };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📋 Parsing HatsOff rota (33 months)…');
  const { months } = parseRota();
  console.log(`   Parsed ${months.length} months of attendance data`);

  // ── 1. Company ─────────────────────────────────────────────────────────────
  console.log('\n🏢 Writing company & site…');
  const companyOps = [{
    ref: db.collection('companies').doc(COMPANY_ID),
    data: {
      name:        'HatsOff Aviation',
      industry:    'Aviation',
      active:      true,
      created_at:  admin.firestore.Timestamp.fromDate(new Date('2023-05-01')),
    },
  }];
  await commitBatch(companyOps);

  // ── 2. Site ────────────────────────────────────────────────────────────────
  const siteOps = [{
    ref: db.collection('sites').doc(SITE_ID),
    data: {
      name:        SITE_NAME,
      company_id:  COMPANY_ID,
      address:     'Kempegowda International Airport, Bengaluru',
      active:      true,
      created_at:  admin.firestore.Timestamp.fromDate(new Date('2023-05-01')),
    },
  }];
  await commitBatch(siteOps);

  // ── 3. Employees (from canonical roster) ───────────────────────────────────
  console.log('\n👷 Writing employee records from canonical roster…');

  // De-duplicate: CLK 813 and CLK 8 are same person (VAGT-0005), skip the '813' entry
  // as it shares a VAGT ID with '8'. Use a Set of vagt_ids already written.
  const writtenVagtIds = new Set();
  const empOps = [];

  Object.entries(CANONICAL_ROSTER).forEach(([key, g]) => {
    if (writtenVagtIds.has(g.vagt_id)) {
      console.log(`   ↩ Skipping duplicate CLK key "${key}" (${g.canonical_name} already written as ${g.vagt_id})`);
      return;
    }
    writtenVagtIds.add(g.vagt_id);

    const docId = empDocId(g.vagt_id);
    // Realistic join date: VAGT-0001 to 0010 = May 2023 (first rota month);
    // later VAGT IDs get later join dates
    const idNum    = parseInt(g.vagt_id.replace('VAGT-', ''), 10);
    const joinYear = idNum <= 10 ? 2023 : 2022;
    const joinMon  = idNum <= 5  ? 5    : (idNum <= 10 ? 6 : 1);
    const joinedAt = new Date(joinYear, joinMon - 1, 1);

    empOps.push({
      ref: db.collection('employees').doc(docId),
      data: {
        name:            g.canonical_name,
        designation:     g.designation,
        grade:           g.grade,
        desig_code:      g.desig_code,
        role_family:     g.role_family,
        employee_id:     g.vagt_id,
        clk_no:          g.clk_no || (Object.keys(CANONICAL_ROSTER).find(k => k === key) || '').replace(/_.*/,'') || null,
        phone:           null,
        email:           null,
        site_ids:        [SITE_ID],
        primary_site:    SITE_ID,
        status:          g.status,
        supervisor_tier: g.supervisor_tier || false,
        historical:      true,   // no Firebase Auth account
        // Leave balance per 2026-27 pay structure:
        // 5 National/Festival Holidays (NFH) + 12 Casual + 7 Sick + accrued Earned
        leave_balance:   { casual: 12, sick: 7, earned: 0, national_holiday: 5 },
        joined_at:       admin.firestore.Timestamp.fromDate(joinedAt),
        created_at:      admin.firestore.Timestamp.fromDate(new Date()),
      },
    });
  });

  await commitBatch(empOps);
  const activeCount = empOps.filter(e => e.data.status === 'active').length;
  console.log(`   ✓ ${empOps.length} employee records written (${activeCount} active, ${empOps.length - activeCount} historical/inactive)`);

  // ── 4. Attendance logs ─────────────────────────────────────────────────────
  console.log('\n📅 Writing attendance logs…');
  let totalLogs = 0;
  const attendanceOps = [];

  for (const { year, month, rows } of months) {
    const daysInMo = daysInMonth(year, month);

    for (const { docId, vagtId, name, days, daysWorked, ot } of rows) {
      for (let dayIdx = 0; dayIdx < daysInMo; dayIdx++) {
        const code = days[dayIdx] || null;
        if (code === null) continue;  // month had fewer days at this index

        const day    = dayIdx + 1;
        const ds     = dateStr(year, month, day);
        const logId  = `${docId}_${ds}`;

        let logData = {
          employee_uid:  docId,
          employee_id:   vagtId,
          employee_name: name,
          site_id:       SITE_ID,
          site_name:     SITE_NAME,
          date:          ds,
          historical:    true,
          created_at:    admin.firestore.Timestamp.fromDate(new Date()),
        };

        if (code === 'P') {
          // Present — realistic 12-hour shift times in IST
          const checkInH  = 7;
          const checkInM  = randInt(0, 15);
          const checkOutH = 19;
          const checkOutM = randInt(0, 20);
          logData = {
            ...logData,
            status:        'present',
            check_in:      istTimestamp(year, month, day, checkInH, checkInM),
            check_out:     istTimestamp(year, month, day, checkOutH, checkOutM),
            hours_worked:  parseFloat((checkOutH - checkInH + (checkOutM - checkInM) / 60).toFixed(2)),
          };
        } else if (code === 'L') {
          logData = { ...logData, status: 'leave', check_in: null, check_out: null, hours_worked: 0 };
        } else if (code === 'W/O') {
          logData = { ...logData, status: 'weekly_off', check_in: null, check_out: null, hours_worked: 0 };
        } else {
          logData = { ...logData, status: 'unknown', raw_code: code, check_in: null, check_out: null, hours_worked: 0 };
        }

        attendanceOps.push({ ref: db.collection('attendance_logs').doc(logId), data: logData });
        totalLogs++;
      }
    }
  }

  await commitBatch(attendanceOps);
  console.log(`   ✓ ${totalLogs} attendance records written`);

  // ── 5. Monthly payslip summaries ───────────────────────────────────────────
  console.log('\n💰 Writing monthly payslip summaries…');
  const payslipOps = [];

  for (const { year, month, rows } of months) {
    for (const { uid, name, daysWorked, ot } of rows) {
      const monthStr = `${year}-${String(month).padStart(2,'0')}`;
      const psId     = `${uid}_${monthStr}`;
      const guard    = guards[uid];

      // Rough daily rate by designation
      const dailyRate = guard.desig_code === 'SO' ? 900
                      : guard.desig_code === 'FO' ? 800 : 700;
      const otRate    = dailyRate * 1.5 / 8;  // per hour

      const basicPay  = (daysWorked || 0) * dailyRate;
      const otPay     = (ot || 0) * 8 * otRate;
      const grossPay  = Math.round(basicPay + otPay);
      const pf        = Math.round(grossPay * 0.12);
      const netPay    = grossPay - pf;

      payslipOps.push({
        ref: db.collection('payslips').doc(psId),
        data: {
          employee_uid:  uid,
          employee_name: name,
          employee_id:   guard.clk_no ? `CLK-${guard.clk_no}` : `HIST-${uid.slice(5,9).toUpperCase()}`,
          site_id:       SITE_ID,
          site_name:     SITE_NAME,
          month:         monthStr,
          days_worked:   daysWorked || 0,
          ot_days:       ot || 0,
          daily_rate:    dailyRate,
          basic_pay:     basicPay,
          ot_pay:        Math.round(otPay),
          gross_pay:     grossPay,
          pf_deduction:  pf,
          net_pay:       netPay,
          status:        'paid',
          historical:    true,
          generated_at:  admin.firestore.Timestamp.fromDate(new Date()),
        },
      });
    }
  }

  await commitBatch(payslipOps);
  console.log(`   ✓ ${payslipOps.length} payslip records written`);

  console.log('\n✅ HatsOff seed complete!');
  console.log(`   Company + site : 2 docs`);
  console.log(`   Employees      : ${empOps.length}`);
  console.log(`   Attendance logs: ${totalLogs}`);
  console.log(`   Payslips       : ${payslipOps.length}`);
  console.log('\nOpen the admin portal → Dashboard to see the numbers populate.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
