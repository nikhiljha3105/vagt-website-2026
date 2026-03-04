// ══════════════════════════════════════════════════════════════
//  VAGT FIREBASE CONFIG — edit THIS file only
//  Get your config from: console.firebase.google.com
//  → Your project → Project Settings (gear icon) → Your apps → Web app
// ══════════════════════════════════════════════════════════════

export const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

// ══════════════════════════════════════════════════════════════
//  HOW TO SET UP FIREBASE (5 minutes):
//
//  1. Go to https://console.firebase.google.com
//  2. Click "Create a project" → name it "vagt-portal" → Create
//  3. In the left menu: Authentication → Get started
//     → Sign-in method → Email/Password → Enable → Save
//  4. Gear icon (top left) → Project Settings → scroll to "Your apps"
//     → Click "</>" (Web) → register app → name it "vagt-web"
//     → Copy the firebaseConfig object → paste the values above
//  5. Authentication → Users → Add user (for each employee/client)
//     → Enter their email + a temporary password
//  6. Save this file. All portals will work immediately.
// ══════════════════════════════════════════════════════════════
