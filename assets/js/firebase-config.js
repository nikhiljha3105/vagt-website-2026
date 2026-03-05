// ══════════════════════════════════════════════════════════════════
//  VAGT FIREBASE CONFIG
//  Edit ONLY the values in firebaseConfig below.
//  All portal pages import auth and db from this single file.
//
//  HOW TO GET YOUR CONFIG (5 min):
//  1. console.firebase.google.com → Select your project
//  2. Gear icon (top-left) → Project Settings → scroll to "Your apps"
//  3. Click the web app "</>" icon → Copy the firebaseConfig object
//  4. Paste the values below, replacing each REPLACE_WITH_... string
//  5. Save this file — all portals will work immediately
// ══════════════════════════════════════════════════════════════════

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "REDACTED_OLD_KEY",
  authDomain:        "vagt---services.firebaseapp.com",
  projectId:         "vagt---services",
  storageBucket:     "vagt---services.firebasestorage.app",
  messagingSenderId: "588596916458",
  appId:             "1:588596916458:web:82c7f5722893f7ae9d2793"
};

// Initialise once — imported everywhere
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ══════════════════════════════════════════════════════════════════
//  FIRESTORE USER MODEL  (Collection: users/{uid})
//
//  Required fields for every user:
//    role:         'admin' | 'employee' | 'client'
//    name:         string
//    email:        string
//    active:       boolean
//    createdAt:    Timestamp
//    createdBy:    uid  (admin who created this account)
//
//  Employee-only fields:
//    clkNo:        string  (e.g. '321')
//    designation:  string  (e.g. 'Security Officer II')
//    site:         string  (e.g. 'Prestige Tech Park')
//    joined:       string  (e.g. '01 Jan 2024')
//    phone:        string
//
//  Client-only fields:
//    clientName:   string  (e.g. 'Prestige Tech Park')
//    contractNo:   string  (e.g. 'VAGT-C-2024-008')
// ══════════════════════════════════════════════════════════════════
