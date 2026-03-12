/**
 * One-time script: sets role: 'admin' custom claim on the admin account.
 *
 * Run from inside firebase/functions/ where firebase-admin is installed:
 *   cd firebase/functions
 *   node ../../set-admin-claim.js
 *
 * DELETE THIS FILE after running successfully.
 */

const admin = require('firebase-admin');

// Uses Application Default Credentials (firebase login sets these up)
admin.initializeApp({
  projectId: 'vagt---services',
});

const auth = admin.auth();

const ADMIN_EMAIL = 'admin@vagtsecurityservices.com';

async function main() {
  console.log(`Looking up user: ${ADMIN_EMAIL}`);
  const user = await auth.getUserByEmail(ADMIN_EMAIL);
  console.log(`Found UID: ${user.uid}`);
  console.log(`Current claims: ${JSON.stringify(user.customClaims)}`);

  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  console.log('✅ Custom claim set: { role: "admin" }');

  // Verify
  const updated = await auth.getUser(user.uid);
  console.log(`Verified claims: ${JSON.stringify(updated.customClaims)}`);
  console.log('Done. You can now delete set-admin-claim.js');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
