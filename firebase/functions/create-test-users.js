/**
 * create-test-users.js — 10 guards + 3 clients
 * Usage: node create-test-users.js ~/Downloads/<key>.json [--wipe]
 *
 * Credentials:
 *   guard001@vagttest.com  / TestGuard@001  — Ravi Kumar        — Prestige Tech Park
 *   guard002@vagttest.com  / TestGuard@002  — Suresh Babu       — Prestige Tech Park (night)
 *   guard003@vagttest.com  / TestGuard@003  — Meena Devi        — Prestige Tech Park
 *   guard004@vagttest.com  / TestGuard@004  — Venkatesh Reddy   — Brigade Gateway (senior)
 *   guard005@vagttest.com  / TestGuard@005  — Priya Lakshmi     — Brigade Gateway
 *   guard006@vagttest.com  / TestGuard@006  — Mohammad Irfan    — Brigade Gateway (night)
 *   guard007@vagttest.com  / TestGuard@007  — Ramesh Gowda      — Manyata Tech Park
 *   guard008@vagttest.com  / TestGuard@008  — Deepak Singh      — Manyata Tech Park (night)
 *   guard009@vagttest.com  / TestGuard@009  — Kavitha Nair      — Manyata Tech Park
 *   guard010@vagttest.com  / TestGuard@010  — Arjun Singh       — Prestige (inactive)
 *   client001@vagttest.com / TestClient@001 — Rajesh Sharma     — DSMax Properties
 *   client002@vagttest.com / TestClient@002 — Sunita Nair       — Brigade Enterprises
 *   client003@vagttest.com / TestClient@003 — Arvind Krishnan   — Prestige Estates
 *   Admin: hello@vagtservices.com / Vagt@2026Admin
 */

'use strict';
const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) { console.error('Usage: node create-test-users.js <key.json> [--wipe]'); process.exit(1); }
const WIPE = process.argv.includes('--wipe');
admin.initializeApp({ credential: admin.credential.cert(path.resolve(keyPath.replace(/^~/, process.env.HOME))), projectId: 'vagt---services' });
const db = admin.firestore();

const P = 'seed-site-prestige-tech';
const B = 'seed-site-brigade-gateway';
const M = 'seed-site-manyata-tech';

const TEST_USERS = [
  { email:'guard001@vagttest.com', pw:'TestGuard@001', dn:'Ravi Kumar (Test)',       role:'employee', col:'employees', p:{ name:'Ravi Kumar',       phone:'+919876540001', employee_id:'VAGT-0001', site_id:P, site_name:'Prestige Tech Park',         status:'active',   shift:'day',   designation:'Security Guard',        keycode:'RVKM-0001', leave_balance:{casual:4,sick:3,earned:2} } },
  { email:'guard002@vagttest.com', pw:'TestGuard@002', dn:'Suresh Babu (Test)',      role:'employee', col:'employees', p:{ name:'Suresh Babu',      phone:'+919876540002', employee_id:'VAGT-0002', site_id:P, site_name:'Prestige Tech Park',         status:'active',   shift:'night', designation:'Security Guard',        keycode:'SRSH-0002', leave_balance:{casual:5,sick:4,earned:1} } },
  { email:'guard003@vagttest.com', pw:'TestGuard@003', dn:'Meena Devi (Test)',       role:'employee', col:'employees', p:{ name:'Meena Devi',       phone:'+919876540003', employee_id:'VAGT-0003', site_id:P, site_name:'Prestige Tech Park',         status:'active',   shift:'day',   designation:'Security Guard',        keycode:'MNDV-0003', leave_balance:{casual:6,sick:4,earned:2} } },
  { email:'guard004@vagttest.com', pw:'TestGuard@004', dn:'Venkatesh Reddy (Test)',  role:'employee', col:'employees', p:{ name:'Venkatesh Reddy',  phone:'+919876540004', employee_id:'VAGT-0004', site_id:B, site_name:'Brigade Gateway',            status:'active',   shift:'day',   designation:'Senior Security Guard', keycode:'VNKT-0004', leave_balance:{casual:3,sick:2,earned:3} } },
  { email:'guard005@vagttest.com', pw:'TestGuard@005', dn:'Priya Lakshmi (Test)',    role:'employee', col:'employees', p:{ name:'Priya Lakshmi',    phone:'+919876540005', employee_id:'VAGT-0005', site_id:B, site_name:'Brigade Gateway',            status:'active',   shift:'day',   designation:'Security Guard',        keycode:'PRYA-0005', leave_balance:{casual:6,sick:4,earned:0} } },
  { email:'guard006@vagttest.com', pw:'TestGuard@006', dn:'Mohammad Irfan (Test)',   role:'employee', col:'employees', p:{ name:'Mohammad Irfan',   phone:'+919876540006', employee_id:'VAGT-0006', site_id:B, site_name:'Brigade Gateway',            status:'active',   shift:'night', designation:'Security Guard',        keycode:'IRFN-0006', leave_balance:{casual:6,sick:4,earned:0} } },
  { email:'guard007@vagttest.com', pw:'TestGuard@007', dn:'Ramesh Gowda (Test)',     role:'employee', col:'employees', p:{ name:'Ramesh Gowda',     phone:'+919876540007', employee_id:'VAGT-0007', site_id:M, site_name:'Manyata Tech Park \u2014 Block D', status:'active',   shift:'day',   designation:'Security Guard',        keycode:'RMSH-0007', leave_balance:{casual:6,sick:4,earned:0} } },
  { email:'guard008@vagttest.com', pw:'TestGuard@008', dn:'Deepak Singh (Test)',     role:'employee', col:'employees', p:{ name:'Deepak Singh',     phone:'+919876540008', employee_id:'VAGT-0008', site_id:M, site_name:'Manyata Tech Park \u2014 Block D', status:'active',   shift:'night', designation:'Security Guard',        keycode:'DPAK-0008', leave_balance:{casual:6,sick:4,earned:0} } },
  { email:'guard009@vagttest.com', pw:'TestGuard@009', dn:'Kavitha Nair (Test)',     role:'employee', col:'employees', p:{ name:'Kavitha Nair',     phone:'+919876540009', employee_id:'VAGT-0009', site_id:M, site_name:'Manyata Tech Park \u2014 Block D', status:'active',   shift:'day',   designation:'Security Guard',        keycode:'KVTH-0009', leave_balance:{casual:6,sick:4,earned:0} } },
  { email:'guard010@vagttest.com', pw:'TestGuard@010', dn:'Arjun Singh (Test)',      role:'employee', col:'employees', p:{ name:'Arjun Singh',      phone:'+919876540010', employee_id:'VAGT-0010', site_id:P, site_name:'Prestige Tech Park',         status:'inactive', shift:'day',   designation:'Security Guard',        keycode:'ARJN-0010', leave_balance:{casual:0,sick:0,earned:0} } },
  { email:'client001@vagttest.com', pw:'TestClient@001', dn:'Rajesh Sharma (Test)',  role:'client',   col:'clients',   p:{ name:'Rajesh Sharma',   phone:'+919845001234', company_name:'DSMax Properties Pvt. Ltd.',           site_id:P, site_name:'Prestige Tech Park' } },
  { email:'client002@vagttest.com', pw:'TestClient@002', dn:'Sunita Nair (Test)',    role:'client',   col:'clients',   p:{ name:'Sunita Nair',     phone:'+919880123456', company_name:'Brigade Enterprises Ltd.',              site_id:B, site_name:'Brigade Gateway' } },
  { email:'client003@vagttest.com', pw:'TestClient@003', dn:'Arvind Krishnan (Test)',role:'client',   col:'clients',   p:{ name:'Arvind Krishnan', phone:'+919741234567', company_name:'Prestige Estates Projects Ltd.',        site_id:M, site_name:'Manyata Tech Park \u2014 Block D' } },
];

async function createAll() {
  console.log('\nCreating / updating test users\u2026\n');
  for (const u of TEST_USERS) {
    try {
      let rec;
      try {
        rec = await admin.auth().getUserByEmail(u.email);
        await admin.auth().updateUser(rec.uid, { password:u.pw, displayName:u.dn, emailVerified:true });
        console.log('  \u21bb updated:', u.email);
      } catch(e) {
        if (e.code !== 'auth/user-not-found') throw e;
        rec = await admin.auth().createUser({ email:u.email, password:u.pw, displayName:u.dn, emailVerified:true });
        console.log('  \u2705 created:', u.email);
      }
      await admin.auth().setCustomUserClaims(rec.uid, { role:u.role });
      await db.collection(u.col).doc(rec.uid).set({ ...u.p, uid:rec.uid, email:u.email, _test:true, joined_at:new Date() }, { merge:true });
      console.log('     role:', u.role.padEnd(8), 'UID:', rec.uid);
    } catch(err) {
      console.error('  \u274c', u.email + ':', err.message);
    }
  }
  console.log('\n\u2705 Done. Run seed-demo-data.js next to populate portal data.\n');
  console.log('  Role       Email                      Password');
  console.log('  ---------  -------------------------  --------------');
  TEST_USERS.forEach(u => console.log(' ', u.role.padEnd(9), '', u.email.padEnd(25), '', u.pw));
  console.log('\n  Login: https://vagtservices.com/pages/portal.html\n');
}

async function wipeAll() {
  console.log('\nDeleting test users\u2026\n');
  for (const u of TEST_USERS) {
    try {
      const rec = await admin.auth().getUserByEmail(u.email);
      await admin.auth().deleteUser(rec.uid);
      await db.collection(u.col).doc(rec.uid).delete();
      console.log('  \u2705 deleted:', u.email);
    } catch(e) {
      console.log(e.code === 'auth/user-not-found' ? '  - not found:' : '  \u274c', u.email);
    }
  }
  console.log('\nDone.\n');
}

(WIPE ? wipeAll() : createAll()).catch(e => { console.error('\u274c', e.message); process.exit(1); });
