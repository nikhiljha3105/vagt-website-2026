/**
 * One-time script: sets role: 'admin' custom claim on the admin account.
 *
 * Requires a service account key JSON file downloaded from:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 *
 * Usage (run from inside firebase/functions/ where firebase-admin is installed):
 *   cd firebase/functions
 *   node ../../set-admin-claim.js /path/to/serviceAccountKey.json
 *
 * Example:
 *   node ../../set-admin-claim.js ~/Downloads/vagt---services-firebase-adminsdk-xxxx.json
 *
 * DELETE THIS FILE and the key JSON after running successfully.
 */

const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('❌ Usage: node set-admin-claim.js /path/to/serviceAccountKey.json');
  process.exit(1);
}

const resolvedPath = keyPath.startsWith('~')
  ? path.join(require('os').homedir(), keyPath.slice(1))
  : path.resolve(keyPath);

admin.initializeApp({
  credential: admin.credential.cert(resolvedPath),
});

const auth = admin.auth();
const ADMIN_EMAIL = 'admin@vagtsecurityservices.com';

async function main() {
  console.log(`Using key: ${resolvedPath}`);
  console.log(`Looking up user: ${ADMIN_EMAIL}`);
  const user = await auth.getUserByEmail(ADMIN_EMAIL);
  console.log(`Found UID: ${user.uid}`);
  console.log(`Current claims: ${JSON.stringify(user.customClaims)}`);

  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  console.log('✅ Custom claim set: { role: "admin" }');

  const updated = await auth.getUser(user.uid);
  console.log(`Verified claims: ${JSON.stringify(updated.customClaims)}`);
  console.log('');
  console.log('Done. Delete set-admin-claim.js and the service account key JSON — keep them out of git.');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
