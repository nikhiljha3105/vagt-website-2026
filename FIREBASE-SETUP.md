# VAGT Portals — Firebase Setup Guide
*Complete this once before going live. Takes ~20 minutes.*

---

## What Firebase gives you

| Feature | Used for |
|---|---|
| **Authentication** | Employee / Client / Admin login with email + password |
| **Firestore** | User profiles + role enforcement (admin / employee / client) |

All portal pages already have the auth code written. You just need to connect them to your Firebase project.

---

## Step 1 — Create a Firebase project

1. Open [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `vagt-services` (or similar)
3. Disable Google Analytics (not needed) → **Create project**

---

## Step 2 — Enable Email/Password Authentication

1. In the left sidebar: **Build → Authentication → Get started**
2. Click **Email/Password** → toggle **Enable** → **Save**

---

## Step 3 — Create Firestore database

1. In the left sidebar: **Build → Firestore Database → Create database**
2. Choose **Start in production mode** → **Next**
3. Pick region **asia-south1 (Mumbai)** → **Enable**

---

## Step 4 — Set Firestore security rules

1. Inside Firestore → click **Rules** tab
2. Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read their own profile; admins can read/write all profiles
    match /users/{userId} {
      allow read: if request.auth != null
                  && (request.auth.uid == userId
                      || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow write: if request.auth != null
                   && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Future collections (announcements, payslips, etc.) — open to all authenticated users for now
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

---

## Step 5 — Register the web app and get your config

1. In Firebase Console → gear icon (top-left) → **Project settings**
2. Scroll down to **Your apps** → click the **</>** web icon
3. App nickname: `vagt-web` → **Register app**
4. You will see a `firebaseConfig` object like this:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "vagt-services.firebaseapp.com",
  projectId:         "vagt-services",
  storageBucket:     "vagt-services.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

5. Copy these 6 values.

---

## Step 6 — Paste config into the website

Open this file:
```
assets/js/firebase-config.js
```

Replace each `REPLACE_WITH_...` placeholder with your actual value:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",        // ← paste your value
  authDomain:        "...",
  projectId:         "...",
  storageBucket:     "...",
  messagingSenderId: "...",
  appId:             "..."
};
```

Save the file. **That's it — all 6 portal pages will now use your Firebase project.**

---

## Step 7 — Create the first admin account

1. Deploy the site to GitHub Pages (or open locally)
2. Navigate to: `yoursite.com/pages/admin-setup.html`
3. Fill in your name, email, and password → **Create Admin Account**
4. The page locks itself permanently after this — no second admin can be created this way

> This page checks Firestore for any existing admin users. Once one exists, it shows a "Setup complete" screen and redirects to the login page.

---

## Step 8 — Create employee and client accounts

Log in to the Admin Panel → use the **Employees** or **Clients** tab to add new users.

Under the hood, each new user needs:
1. A Firebase Auth account (email + password) — create via Firebase Console → **Authentication → Users → Add user**
2. A Firestore document at `users/{uid}` — the admin dashboard will handle this when the **Add Employee** form is built

**For now (before the form is ready)**, you can do it manually:

### Add an employee manually

1. Firebase Console → **Authentication → Users → Add user**
   - Enter their email and a temporary password
   - Copy the generated UID

2. Firestore → **users → Add document**
   - Document ID: paste the UID from step 1
   - Fields:

| Field | Type | Value |
|---|---|---|
| `role` | string | `employee` |
| `name` | string | `Ravi Kumar` |
| `email` | string | `ravi@vagtservices.com` |
| `active` | boolean | `true` |
| `clkNo` | string | `321` |
| `designation` | string | `Security Officer II` |
| `site` | string | `Prestige Tech Park` |
| `joined` | string | `01 Jan 2024` |
| `phone` | string | `+91 98765 43210` |
| `createdAt` | timestamp | (click "Server timestamp") |
| `createdBy` | string | (your admin UID) |

### Add a client manually

Same process, but use these fields:

| Field | Type | Value |
|---|---|---|
| `role` | string | `client` |
| `name` | string | `Contact Person Name` |
| `email` | string | `contact@hatsoff.com` |
| `active` | boolean | `true` |
| `clientName` | string | `Hatsoff Hospitality` |
| `contractNo` | string | `VAGT-C-2024-001` |
| `createdAt` | timestamp | (Server timestamp) |
| `createdBy` | string | (your admin UID) |

---

## Step 9 — Notify users

Send each new employee or client:
- Their login URL (`yoursite.com/pages/employee-portal.html` or `client-portal.html`)
- Their email address
- Their temporary password (they can use "Forgot password?" to set their own)

---

## How role enforcement works

Every login attempt goes through this flow:

```
User submits email + password
        ↓
Firebase Auth — verifies credentials
        ↓
Firestore — reads users/{uid}
        ↓
Checks: role === expected role?   ← wrong role → "This account does not have access"
Checks: active === true?          ← inactive → "Your account is currently inactive"
        ↓
Redirect to correct dashboard
```

This means an employee who tries to access the admin panel will be signed out immediately — even if they somehow navigate to the URL directly.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not connect to Firebase" on setup page | `firebase-config.js` still has `REPLACE_WITH_...` values |
| Login hangs / no response | Check browser console for Firebase errors |
| "No account found" after login | User exists in Auth but has no Firestore `users/{uid}` doc |
| "Wrong role" error | User's `role` field in Firestore doesn't match the portal they're trying to use |
| Setup page shows "Setup complete" immediately | A user with `role: 'admin'` already exists in Firestore |
| Admin can access employee portal | Each portal checks role independently — working as intended |

---

## Files reference

| File | Purpose |
|---|---|
| `assets/js/firebase-config.js` | **Edit this** — paste your Firebase credentials here |
| `assets/js/vagt-auth.js` | Shared auth logic — do not edit unless you know what you're doing |
| `pages/admin-setup.html` | First-run setup — locked after first admin is created |
| `pages/admin-portal.html` | Admin login |
| `pages/employee-portal.html` | Employee login |
| `pages/client-portal.html` | Client login |
| `pages/admin-dashboard.html` | Admin workspace |
| `pages/employee-dashboard.html` | Employee self-service |
| `pages/client-dashboard.html` | Client reporting view |
