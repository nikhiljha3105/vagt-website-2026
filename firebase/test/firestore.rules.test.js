/**
 * VAGT Security — Firestore Security Rule Unit Tests
 *
 * Run against the Firebase emulator:
 *   cd firebase/test && npm test
 *
 * Emulator must be running first:
 *   firebase emulators:start --only firestore --project vagt-security-prod
 *
 * Covers all 15 collections in firestore.rules.
 */

'use strict';

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const path = require('path');
const fs   = require('fs');

const PROJECT_ID   = 'vagt-security-prod';
const RULES_FILE   = path.join(__dirname, '..', 'firestore.rules');
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

// ── UIDs ──────────────────────────────────────────────────────────────────────
const ADMIN_UID    = 'admin-uid-001';
const EMP_UID_A    = 'emp-uid-aaa';
const EMP_UID_B    = 'emp-uid-bbb';
const CLIENT_UID_A = 'client-uid-aaa';
const CLIENT_UID_B = 'client-uid-bbb';

// ── Test env ──────────────────────────────────────────────────────────────────
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_FILE, 'utf8'),
      host: EMULATOR_HOST.split(':')[0],
      port: parseInt(EMULATOR_HOST.split(':')[1], 10),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminCtx() {
  return testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' });
}
function empCtx(uid) {
  return testEnv.authenticatedContext(uid, { role: 'employee' });
}
function clientCtx(uid) {
  return testEnv.authenticatedContext(uid, { role: 'client' });
}
function anonCtx() {
  return testEnv.unauthenticatedContext();
}

async function seedDoc(collection, docId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(collection).doc(docId).set(data);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. employees/{uid}
// ══════════════════════════════════════════════════════════════════════════════

describe('employees/{uid}', () => {
  beforeEach(async () => {
    await seedDoc('employees', EMP_UID_A, { name: 'Rajan Kumar', employee_id: 'VAGT-0001', status: 'active' });
  });

  test('employee can read own doc', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertSucceeds(db.collection('employees').doc(EMP_UID_A).get());
  });

  test('employee cannot read another employee doc', async () => {
    const db = empCtx(EMP_UID_B).firestore();
    await assertFails(db.collection('employees').doc(EMP_UID_A).get());
  });

  test('admin can read any employee doc', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('employees').doc(EMP_UID_A).get());
  });

  test('client cannot read employee doc', async () => {
    const db = clientCtx(CLIENT_UID_A).firestore();
    await assertFails(db.collection('employees').doc(EMP_UID_A).get());
  });

  test('unauthenticated cannot read', async () => {
    await assertFails(anonCtx().firestore().collection('employees').doc(EMP_UID_A).get());
  });

  test('employee can write own doc', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertSucceeds(db.collection('employees').doc(EMP_UID_A).update({ phone: '+919000000000' }));
  });

  test('employee cannot write another employee doc', async () => {
    const db = empCtx(EMP_UID_B).firestore();
    await assertFails(db.collection('employees').doc(EMP_UID_A).update({ phone: '+919000000001' }));
  });

  test('admin can write any employee doc', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('employees').doc(EMP_UID_A).update({ status: 'inactive' }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. clients/{uid}
// ══════════════════════════════════════════════════════════════════════════════

describe('clients/{uid}', () => {
  beforeEach(async () => {
    await seedDoc('clients', CLIENT_UID_A, { name: 'EY India', company_name: 'EY India' });
  });

  test('client can read own doc', async () => {
    await assertSucceeds(clientCtx(CLIENT_UID_A).firestore().collection('clients').doc(CLIENT_UID_A).get());
  });

  test('client cannot read another client doc', async () => {
    await assertFails(clientCtx(CLIENT_UID_B).firestore().collection('clients').doc(CLIENT_UID_A).get());
  });

  test('admin can read any client doc', async () => {
    await assertSucceeds(adminCtx().firestore().collection('clients').doc(CLIENT_UID_A).get());
  });

  test('employee cannot read client doc', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('clients').doc(CLIENT_UID_A).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. admins/{uid}
// ══════════════════════════════════════════════════════════════════════════════

describe('admins/{uid}', () => {
  beforeEach(async () => {
    await seedDoc('admins', ADMIN_UID, { name: 'Super Admin' });
  });

  test('admin can read admin doc', async () => {
    await assertSucceeds(adminCtx().firestore().collection('admins').doc(ADMIN_UID).get());
  });

  test('employee cannot read admin doc', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('admins').doc(ADMIN_UID).get());
  });

  test('client cannot read admin doc', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('admins').doc(ADMIN_UID).get());
  });

  test('unauthenticated cannot read admin doc', async () => {
    await assertFails(anonCtx().firestore().collection('admins').doc(ADMIN_UID).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. attendance_logs/{logId}
// ══════════════════════════════════════════════════════════════════════════════

describe('attendance_logs/{logId}', () => {
  const logId = 'log-001';

  beforeEach(async () => {
    await seedDoc('attendance_logs', logId, { employee_uid: EMP_UID_A, date: '2026-03-09', check_in: new Date() });
  });

  test('employee can read own log', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('attendance_logs').doc(logId).get());
  });

  test('employee cannot read another employee log', async () => {
    await assertFails(empCtx(EMP_UID_B).firestore().collection('attendance_logs').doc(logId).get());
  });

  test('employee can create log with matching uid', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertSucceeds(db.collection('attendance_logs').add({
      employee_uid: EMP_UID_A,
      date: '2026-03-10',
      check_in: new Date(),
    }));
  });

  test('employee cannot create log with different uid', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertFails(db.collection('attendance_logs').add({
      employee_uid: EMP_UID_B,
      date: '2026-03-10',
      check_in: new Date(),
    }));
  });

  test('admin can read all logs', async () => {
    await assertSucceeds(adminCtx().firestore().collection('attendance_logs').doc(logId).get());
  });

  test('admin can write logs', async () => {
    await assertSucceeds(adminCtx().firestore().collection('attendance_logs').doc(logId).update({ check_out: new Date() }));
  });

  test('client cannot read attendance logs', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('attendance_logs').doc(logId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. leave_requests/{leaveId}
// ══════════════════════════════════════════════════════════════════════════════

describe('leave_requests/{leaveId}', () => {
  const leaveId = 'leave-001';

  beforeEach(async () => {
    await seedDoc('leave_requests', leaveId, {
      employee_uid: EMP_UID_A,
      leave_type: 'casual',
      from_date: '2026-03-15',
      to_date: '2026-03-16',
      status: 'pending',
    });
  });

  test('employee can read own leave request', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('leave_requests').doc(leaveId).get());
  });

  test('employee cannot read another employee leave request', async () => {
    await assertFails(empCtx(EMP_UID_B).firestore().collection('leave_requests').doc(leaveId).get());
  });

  test('employee can create leave request with matching uid', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertSucceeds(db.collection('leave_requests').add({
      employee_uid: EMP_UID_A,
      leave_type: 'sick',
      from_date: '2026-04-01',
      to_date: '2026-04-01',
      reason: 'Test',
      status: 'pending',
    }));
  });

  test('employee cannot create leave request for another employee', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertFails(db.collection('leave_requests').add({
      employee_uid: EMP_UID_B,
      leave_type: 'sick',
      status: 'pending',
    }));
  });

  test('admin can read all leave requests', async () => {
    await assertSucceeds(adminCtx().firestore().collection('leave_requests').doc(leaveId).get());
  });

  test('admin can approve leave request', async () => {
    await assertSucceeds(adminCtx().firestore().collection('leave_requests').doc(leaveId).update({ status: 'approved' }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. payslips/{slipId}
// ══════════════════════════════════════════════════════════════════════════════

describe('payslips/{slipId}', () => {
  const slipId = 'slip-001';

  beforeEach(async () => {
    await seedDoc('payslips', slipId, {
      employee_uid: EMP_UID_A,
      period: '2026-02',
      net_pay: 18500,
    });
  });

  test('employee can read own payslip', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('payslips').doc(slipId).get());
  });

  test('employee cannot read another employee payslip', async () => {
    await assertFails(empCtx(EMP_UID_B).firestore().collection('payslips').doc(slipId).get());
  });

  test('employee cannot write payslip', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('payslips').doc(slipId).update({ net_pay: 99999 }));
  });

  test('admin can read payslip', async () => {
    await assertSucceeds(adminCtx().firestore().collection('payslips').doc(slipId).get());
  });

  test('admin can write payslip', async () => {
    await assertSucceeds(adminCtx().firestore().collection('payslips').doc(slipId).update({ pdf_url: 'https://storage.example.com/slip.pdf' }));
  });

  test('client cannot read payslip', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('payslips').doc(slipId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. shifts/{shiftId}
// ══════════════════════════════════════════════════════════════════════════════

describe('shifts/{shiftId}', () => {
  const shiftId = 'shift-001';

  beforeEach(async () => {
    await seedDoc('shifts', shiftId, {
      employee_uid: EMP_UID_A,
      date: '2026-03-10',
      shift_type: 'morning',
    });
  });

  test('employee can read own shift', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('shifts').doc(shiftId).get());
  });

  test('employee cannot read another employee shift', async () => {
    await assertFails(empCtx(EMP_UID_B).firestore().collection('shifts').doc(shiftId).get());
  });

  test('employee cannot write shifts', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('shifts').doc(shiftId).update({ shift_type: 'night' }));
  });

  test('admin can read and write shifts', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('shifts').doc(shiftId).get());
    await assertSucceeds(db.collection('shifts').doc(shiftId).update({ shift_type: 'afternoon' }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. incidents/{incidentId}
// ══════════════════════════════════════════════════════════════════════════════

describe('incidents/{incidentId}', () => {
  const incidentId = 'inc-001';

  beforeEach(async () => {
    await seedDoc('incidents', incidentId, {
      employee_uid: EMP_UID_A,
      type: 'trespassing',
      severity: 'medium',
      status: 'submitted',
    });
  });

  test('employee can read own incident', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('incidents').doc(incidentId).get());
  });

  test('employee cannot read another employee incident', async () => {
    await assertFails(empCtx(EMP_UID_B).firestore().collection('incidents').doc(incidentId).get());
  });

  test('employee can create incident with matching uid', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertSucceeds(db.collection('incidents').add({
      employee_uid: EMP_UID_A,
      type: 'suspicious_activity',
      severity: 'low',
      description: 'Observed suspicious activity.',
      status: 'submitted',
    }));
  });

  test('employee cannot create incident for another uid', async () => {
    const db = empCtx(EMP_UID_A).firestore();
    await assertFails(db.collection('incidents').add({
      employee_uid: EMP_UID_B,
      type: 'suspicious_activity',
      severity: 'low',
    }));
  });

  test('admin can read all incidents', async () => {
    await assertSucceeds(adminCtx().firestore().collection('incidents').doc(incidentId).get());
  });

  test('admin can update incident status', async () => {
    await assertSucceeds(adminCtx().firestore().collection('incidents').doc(incidentId).update({ status: 'acknowledged' }));
  });

  test('client cannot read incidents', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('incidents').doc(incidentId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. complaints/{complaintId}
// ══════════════════════════════════════════════════════════════════════════════

describe('complaints/{complaintId}', () => {
  const complaintId = 'cmp-001';

  beforeEach(async () => {
    await seedDoc('complaints', complaintId, {
      client_uid: CLIENT_UID_A,
      subject: 'Guard absent',
      status: 'open',
    });
  });

  test('client can read own complaint', async () => {
    await assertSucceeds(clientCtx(CLIENT_UID_A).firestore().collection('complaints').doc(complaintId).get());
  });

  test('client cannot read another client complaint', async () => {
    await assertFails(clientCtx(CLIENT_UID_B).firestore().collection('complaints').doc(complaintId).get());
  });

  test('client can create complaint with matching uid', async () => {
    const db = clientCtx(CLIENT_UID_A).firestore();
    await assertSucceeds(db.collection('complaints').add({
      client_uid: CLIENT_UID_A,
      subject: 'New complaint',
      type: 'complaint',
      status: 'open',
    }));
  });

  test('client cannot create complaint for another client', async () => {
    const db = clientCtx(CLIENT_UID_A).firestore();
    await assertFails(db.collection('complaints').add({
      client_uid: CLIENT_UID_B,
      subject: 'Spoofed complaint',
      status: 'open',
    }));
  });

  test('admin can read and update complaints', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('complaints').doc(complaintId).get());
    await assertSucceeds(db.collection('complaints').doc(complaintId).update({ status: 'in_progress', admin_note: 'Looking into it.' }));
  });

  test('employee cannot read complaints', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('complaints').doc(complaintId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. daily_reports/{reportId}
// ══════════════════════════════════════════════════════════════════════════════

describe('daily_reports/{reportId}', () => {
  const reportId = 'rpt-001';

  beforeEach(async () => {
    await seedDoc('daily_reports', reportId, {
      site_client_uid: CLIENT_UID_A,
      site_id: 'site-001',
      date: '2026-03-09',
      summary: 'All clear.',
    });
  });

  test('client can read own report', async () => {
    await assertSucceeds(clientCtx(CLIENT_UID_A).firestore().collection('daily_reports').doc(reportId).get());
  });

  test('client cannot read another client report', async () => {
    await assertFails(clientCtx(CLIENT_UID_B).firestore().collection('daily_reports').doc(reportId).get());
  });

  test('admin can read and write reports', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('daily_reports').doc(reportId).get());
    await assertSucceeds(db.collection('daily_reports').doc(reportId).update({ summary: 'Updated.' }));
  });

  test('employee cannot read daily reports', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('daily_reports').doc(reportId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. invoices/{invoiceId}
// ══════════════════════════════════════════════════════════════════════════════

describe('invoices/{invoiceId}', () => {
  const invoiceId = 'inv-001';

  beforeEach(async () => {
    await seedDoc('invoices', invoiceId, {
      client_uid: CLIENT_UID_A,
      invoice_number: 'VAGT-INV-2026-001',
      amount: 48000,
      status: 'unpaid',
    });
  });

  test('client can read own invoice', async () => {
    await assertSucceeds(clientCtx(CLIENT_UID_A).firestore().collection('invoices').doc(invoiceId).get());
  });

  test('client cannot read another client invoice', async () => {
    await assertFails(clientCtx(CLIENT_UID_B).firestore().collection('invoices').doc(invoiceId).get());
  });

  test('client cannot write invoices', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('invoices').doc(invoiceId).update({ amount: 1 }));
  });

  test('admin can read and write invoices', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('invoices').doc(invoiceId).get());
    await assertSucceeds(db.collection('invoices').doc(invoiceId).update({ status: 'paid' }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 12. sites/{siteId}
// ══════════════════════════════════════════════════════════════════════════════

describe('sites/{siteId}', () => {
  const siteId = 'site-001';

  beforeEach(async () => {
    await seedDoc('sites', siteId, { name: 'EY Tower', client_uid: CLIENT_UID_A, guards_deployed: 4 });
  });

  test('employee can read sites', async () => {
    await assertSucceeds(empCtx(EMP_UID_A).firestore().collection('sites').doc(siteId).get());
  });

  test('client can read sites', async () => {
    await assertSucceeds(clientCtx(CLIENT_UID_A).firestore().collection('sites').doc(siteId).get());
  });

  test('admin can read sites', async () => {
    await assertSucceeds(adminCtx().firestore().collection('sites').doc(siteId).get());
  });

  test('unauthenticated cannot read sites', async () => {
    await assertFails(anonCtx().firestore().collection('sites').doc(siteId).get());
  });

  test('employee cannot write sites', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('sites').doc(siteId).update({ guards_deployed: 99 }));
  });

  test('client cannot write sites', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('sites').doc(siteId).update({ guards_deployed: 99 }));
  });

  test('admin can write sites', async () => {
    await assertSucceeds(adminCtx().firestore().collection('sites').doc(siteId).update({ guards_deployed: 5 }));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 13. companies/{companyId}
// ══════════════════════════════════════════════════════════════════════════════

describe('companies/{companyId}', () => {
  const companyId = 'vagt-company';

  beforeEach(async () => {
    await seedDoc('companies', companyId, { name: 'VAGT Security Services Pvt Ltd' });
  });

  test('admin can read companies', async () => {
    await assertSucceeds(adminCtx().firestore().collection('companies').doc(companyId).get());
  });

  test('employee cannot read companies', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('companies').doc(companyId).get());
  });

  test('client cannot read companies', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('companies').doc(companyId).get());
  });

  test('unauthenticated cannot read companies', async () => {
    await assertFails(anonCtx().firestore().collection('companies').doc(companyId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 14. activity_log/{logId}
// ══════════════════════════════════════════════════════════════════════════════

describe('activity_log/{logId}', () => {
  const actLogId = 'act-001';

  beforeEach(async () => {
    await seedDoc('activity_log', actLogId, { type: 'check_in', description: 'Rajan checked in', time: new Date() });
  });

  test('admin can read activity log', async () => {
    await assertSucceeds(adminCtx().firestore().collection('activity_log').doc(actLogId).get());
  });

  test('admin cannot write activity log (server-side only)', async () => {
    await assertFails(adminCtx().firestore().collection('activity_log').doc(actLogId).update({ description: 'Tampered' }));
  });

  test('employee cannot read activity log', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('activity_log').doc(actLogId).get());
  });

  test('client cannot read activity log', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('activity_log').doc(actLogId).get());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 15. pending_registrations/{regId}
// ══════════════════════════════════════════════════════════════════════════════

describe('pending_registrations/{regId}', () => {
  const regId = 'reg-001';

  beforeEach(async () => {
    await seedDoc('pending_registrations', regId, { phone: '+919000000000', verified: false });
  });

  test('unauthenticated can create a registration', async () => {
    await assertSucceeds(anonCtx().firestore().collection('pending_registrations').add({
      phone: '+919111111111',
      email: 'test@test.com',
      otp: '123456',
      verified: false,
    }));
  });

  test('admin can read registrations', async () => {
    await assertSucceeds(adminCtx().firestore().collection('pending_registrations').doc(regId).get());
  });

  test('admin can update/delete registrations', async () => {
    const db = adminCtx().firestore();
    await assertSucceeds(db.collection('pending_registrations').doc(regId).update({ verified: true }));
    await assertSucceeds(db.collection('pending_registrations').doc(regId).delete());
  });

  test('unauthenticated cannot read registrations', async () => {
    await assertFails(anonCtx().firestore().collection('pending_registrations').doc(regId).get());
  });

  test('employee cannot read registrations', async () => {
    await assertFails(empCtx(EMP_UID_A).firestore().collection('pending_registrations').doc(regId).get());
  });

  test('client cannot read registrations', async () => {
    await assertFails(clientCtx(CLIENT_UID_A).firestore().collection('pending_registrations').doc(regId).get());
  });
});
