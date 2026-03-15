/**
 * create-test-users.js
 * Creates Firebase Auth accounts for test employees and clients,
 * sets role claims, and writes their Firestore profile documents.
 *
 * Usage (run from firebase/functions/):
 *   node create-test-users.js ~/Downloads/<service-account-key>.json
 *
 * To delete all test users:
 *   node create-test-users.js ~/Downloads/<key>.json --wipe
 *
 * Credentials after running:
 *   Employee:  guard001@vagttest.com  / TestGuard@001
 *   Employee:  guard002@vagttest.com  / TestGuard@002
 *   Client:    client001@vagttest.com / TestClient@001
 */

const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node create-test-users.js <path-to-key.json> [--wipe]');
  process.exit(1);
}

const WIPE = process.argv.includes('--wipe');
const resolvedPath = path.resolve(keyPath.replace(/^~/, process.env.HOME));

admin.initializeApp({
  credential: admin.credential.cert(resolvedPath),
  projectId: 'vagt---services',
});

const db = admin.firestore();

const TEST_USERS = [
  {
    email:       'guard001@vagttest.com',
    password:    'TestGuard@001',
    displayName: 'Ravi Kumar (Test)',
    role:        'employee',
    profile: {
      name:      'Ravi Kumar',
      phone:     '+919876540001',
      site_id:   'seed-site-prestige-tech',
      site_name: 'Prestige Tech Park',
      status:    'active',
      keycode:   'RVKM-0001',
      _test:     true,
    },
    collection: 'employees',
  },
  {
    email:       'guard002@vagttest.com',
    password:    'TestGuard@002',
    displayName: 'Suresh Babu (Test)',
    role:        'employee',
    profile: {
      name:      'Suresh Babu',
      phone:     '+919876540002',
      site_id:   'seed-site-prestige-tech',
      site_name: 'Prestige Tech Park',
      status:    'active',
      keycode:   'SRSH-0002',
      _test:     true,
    },
    collection: 'employees',
  },
  {
    email:       'client001@vagttest.com',
    password:    'TestClient@001',
    displayName: 'Rajesh Sharma (Test)',
    role:        'client',
    profile: {
      name:         'Rajesh Sharma',
      company_name: 'DSMax Security',
      site_id:      'seed-site-prestige-tech',
      site_name:    'Prestige Tech Park',
      phone:        '+919845001234',
      _test:        true,
    },
    collection: 'clients',
  },
];

async function createAll() {
  console.log('\nCreating test users…\n');

  for (const u of TEST_USERS) {
    try {
      // Create or update Firebase Auth account
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(u.email);
        await admin.auth().updateUser(userRecord.uid, {
          password:    u.password,
          displayName: u.displayName,
          emailVerified: true,
        });
        console.log(`  ↻ updated existing: ${u.email}`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({
            email:         u.email,
            password:      u.password,
            displayName:   u.displayName,
            emailVerified: true,
          });
          console.log(`  ✅ created: ${u.email}`);
        } else { throw e; }
      }

      // Set role claim
      await admin.auth().setCustomUserClaims(userRecord.uid, { role: u.role });

      // Write Firestore profile
      await db.collection(u.collection).doc(userRecord.uid).set({
        ...u.profile,
        uid:        userRecord.uid,
        email:      u.email,
        joined_at:  new Date(),
      }, { merge: true });

      console.log(`     role: ${u.role} | UID: ${userRecord.uid}`);
    } catch (err) {
      console.error(`  ❌ ${u.email}: ${err.message}`);
    }
  }

  console.log('\n✅ Done. Test credentials:\n');
  console.log('  Role       Email                    Password');
  console.log('  ─────────  ───────────────────────  ───────────────');
  TEST_USERS.forEach(u => {
    console.log(`  ${u.role.padEnd(9)}  ${u.email.padEnd(23)}  ${u.password}`);
  });
  console.log('\n  Login at: https://vagt---services.web.app/pages/portal.html');
  console.log('  Admin:    hello@vagtservices.com / Vagt@2026Admin\n');
}

async function wipeAll() {
  console.log('\nDeleting test users…\n');
  for (const u of TEST_USERS) {
    try {
      const userRecord = await admin.auth().getUserByEmail(u.email);
      await admin.auth().deleteUser(userRecord.uid);
      await db.collection(u.collection).doc(userRecord.uid).delete();
      console.log(`  ✅ deleted: ${u.email}`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`  — not found: ${u.email}`);
      } else {
        console.error(`  ❌ ${u.email}: ${e.message}`);
      }
    }
  }
  console.log('\nDone.\n');
}

(WIPE ? wipeAll() : createAll()).catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
