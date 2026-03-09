'use strict';

const { clearFirestoreData } = require('@firebase/rules-unit-testing');

module.exports = async function () {
  try {
    await clearFirestoreData({ projectId: 'vagt-security-prod' });
  } catch (_) {
    // Emulator may not be running; ignore
  }
};
