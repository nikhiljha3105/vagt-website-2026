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

// Designation labels
const DESIG_MAP = {
  'FO': 'Field Officer',
  'SO': 'Security Officer',
  'SG': 'Security Guard',
};

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

/** Stable UUID from guard name (consistent across runs) */
function guardUid(name) {
  return 'hist_' + crypto.createHash('sha256')
    .update(name.trim().toUpperCase())
    .digest('hex')
    .slice(0, 20);
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
  const guards = {};   // uid → guard meta
  const months = [];   // { year, month, rows: [{ uid, name, days: ['P'|'L'|'W/O'|null], daysWorked, ot }] }

  for (const sheetName of wb.SheetNames) {
    const ym = SHEET_MONTH_MAP[sheetName];
    if (!ym) { console.warn(`  skipping unmapped sheet: "${sheetName}"`); continue; }

    const ws   = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const monthRows = [];

    for (const row of data) {
      const sn   = row[0];
      const clNo = row[1];
      const desig= row[2];
      const name = row[3];
      if (!Number.isInteger(sn) || !name || typeof name !== 'string') continue;
      if (name.trim() === 'DESIG') continue;

      const uid = guardUid(name);
      const dayVals = row.slice(4, 35).map(v => v === null ? null : String(v).trim());
      const totalDays = ym.month === 2
        ? daysInMonth(ym.year, ym.month)
        : (row[35] !== null && Number.isInteger(row[35]) ? null : null);

      const daysWorked = typeof row[35] === 'number' ? row[35] : null;
      const ot         = typeof row[36] === 'number' ? row[36] : 0;

      if (!guards[uid]) {
        guards[uid] = {
          uid,
          name:        name.trim(),
          designation: DESIG_MAP[String(desig).trim()] || String(desig).trim(),
          desig_code:  String(desig).trim(),
          clk_no:      clNo ? String(clNo) : null,
          first_seen:  `${ym.year}-${String(ym.month).padStart(2,'0')}`,
        };
      }

      monthRows.push({ uid, name: name.trim(), days: dayVals, daysWorked, ot });
    }

    months.push({ year: ym.year, month: ym.month, sheetName, rows: monthRows });
  }

  return { guards, months };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📋 Parsing HatsOff rota (33 months)…');
  const { guards, months } = parseRota();
  console.log(`   Found ${Object.keys(guards).length} unique guards across ${months.length} months`);

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

  // ── 3. Employees ───────────────────────────────────────────────────────────
  console.log('\n👷 Writing employee records…');
  const empOps = Object.values(guards).map(g => {
    // Derive a realistic join date from first_seen
    const [fyStr, fmStr] = g.first_seen.split('-');
    const joinedAt = new Date(parseInt(fyStr), parseInt(fmStr) - 1, 1);

    return {
      ref: db.collection('employees').doc(g.uid),
      data: {
        name:          g.name,
        designation:   g.designation,
        desig_code:    g.desig_code,
        employee_id:   g.clk_no ? `CLK-${g.clk_no}` : `HIST-${g.uid.slice(5,9).toUpperCase()}`,
        clk_no:        g.clk_no || null,
        phone:         null,
        email:         null,
        site_ids:      [SITE_ID],
        primary_site:  SITE_ID,
        status:        'active',
        historical:    true,   // flag — no Firebase Auth account
        leave_balance: { casual: 6, sick: 4, earned: 2 },
        joined_at:     admin.firestore.Timestamp.fromDate(joinedAt),
        created_at:    admin.firestore.Timestamp.fromDate(new Date()),
      },
    };
  });
  await commitBatch(empOps);
  console.log(`   ✓ ${empOps.length} employees written`);

  // ── 4. Attendance logs ─────────────────────────────────────────────────────
  console.log('\n📅 Writing attendance logs…');
  let totalLogs = 0;
  const attendanceOps = [];

  for (const { year, month, rows } of months) {
    const daysInMo = daysInMonth(year, month);

    for (const { uid, name, days, daysWorked, ot } of rows) {
      for (let dayIdx = 0; dayIdx < daysInMo; dayIdx++) {
        const code = days[dayIdx] || null;
        if (code === null) continue;  // month had fewer days at this index

        const day    = dayIdx + 1;
        const ds     = dateStr(year, month, day);
        const logId  = `${uid}_${ds}`;

        let logData = {
          employee_uid:  uid,
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
