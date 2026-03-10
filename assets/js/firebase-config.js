// ─────────────────────────────────────────────────────────────────────────────
// VAGT Security Services — Firebase Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// This file is safe to commit to git.
// Firebase client config is NOT a secret — security is enforced by:
//   • Firestore Security Rules  (firebase/firestore.rules)
//   • Firebase Authentication   (role claims checked server-side)
//   • API key restrictions      (set in Google Cloud Console → Credentials)
//
// The ONE thing that must never be committed: service account JSON files.
//
// If you need to rotate the API key:
//   1. Go to Google Cloud Console → APIs & Services → Credentials
//   2. Create a new key (restrict it to your domain + Firebase APIs)
//   3. Update apiKey below
//   4. Delete the old key
//   5. Commit this file
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB8jOeTk3u6QkXz190qb3Q-I8RiWVuPXv4",
  authDomain:        "vagt---services.firebaseapp.com",
  projectId:         "vagt---services",
  storageBucket:     "vagt---services.firebasestorage.app",
  messagingSenderId: "588596916458",
  appId:             "1:588596916458:web:82c7f5722893f7ae9d2793",
  measurementId:     "G-T565PJTJJN"
};
