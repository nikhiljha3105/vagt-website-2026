/**
 * Jest global setup — starts the Firestore emulator process.
 * The emulator must be installed: firebase setup:emulators:firestore
 */
'use strict';

const { execSync } = require('child_process');

module.exports = async function () {
  // The emulator is expected to already be running when tests execute.
  // Start it manually: firebase emulators:start --only firestore --project vagt-security-prod
  // Or use: firebase emulators:exec --only firestore "npm test"
  console.log('\n[setup] Firestore emulator should be running on port 8080.');
  console.log('[setup] Start with: firebase emulators:start --only firestore --project vagt-security-prod\n');
};
