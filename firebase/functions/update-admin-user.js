/**
 * update-admin-user.js
 * Looks up hello@vagtservices.com, sets admin claim + new password.
 *
 * Usage (run from firebase/functions/):
 *   node update-admin-user.js <path-to-service-account-key.json>
 */

const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node update-admin-user.js <path-to-service-account-key.json>');
  process.exit(1);
}

const resolvedPath = path.resolve(keyPath.replace(/^~/, process.env.HOME));

admin.initializeApp({
  credential: admin.credential.cert(resolvedPath),
  projectId:  'vagt---services',
});

const TARGET_EMAIL = 'hello@vagtservices.com';
const NEW_PASSWORD = 'Vagt@2026Admin';

(async () => {
  try {
    // Look up the existing account by email
    const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
    console.log('Found account — UID:', user.uid);

    // Set password
    await admin.auth().updateUser(user.uid, {
      password:      NEW_PASSWORD,
      emailVerified: true,
    });

    // Set admin role claim
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });

    console.log('');
    console.log('✅ Done.');
    console.log('   Email   :', TARGET_EMAIL);
    console.log('   Password:', NEW_PASSWORD);
    console.log('   Role    : admin');
    console.log('');
    console.log('→ Sign in at: https://vagt---services.web.app/pages/portal.html');
    console.log('→ Change your password after first login.');
    console.log('');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
})();
