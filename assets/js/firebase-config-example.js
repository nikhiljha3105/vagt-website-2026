// ─────────────────────────────────────────────────────────────────────────────
// VAGT Security Services — Firebase Configuration (EXAMPLE FILE)
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO USE:
//   1. Copy this file to  assets/js/firebase-config.js
//   2. Fill in your real values from Firebase Console → Project Settings → Your apps
//   3. DO NOT commit firebase-config.js — it is already in .gitignore
//
// BEFORE GOING LIVE:
//   • Rotate the API key (see SECURITY_CONTROLS.md — INC-001)
//   • Enable Email/Password sign-in in Firebase Console → Authentication → Sign-in method
//   • Set custom role claims on each user account:
//       { role: "employee" }  for guards/supervisors
//       { role: "client" }    for client contacts  (future)
//       { role: "admin" }     for VAGT management  (future)
//   Use the Firebase Admin SDK or a Cloud Function to set these claims:
//       admin.auth().setCustomUserClaims(uid, { role: 'employee' })
//
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_FIREBASE_API_KEY",
  authDomain:        "vagt-security-prod.firebaseapp.com",
  projectId:         "vagt-security-prod",
  storageBucket:     "vagt-security-prod.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
