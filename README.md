# VAGT Security Services — Website & Platform

Official website and internal portals for VAGT Security Services, Bengaluru.

Live site: **https://vagtsecurityservices.com**

---

## What's here

| Area | Status | Notes |
|------|--------|-------|
| Public website (7 pages) | ✅ Live | Home, About, Security, Facilities, Surveillance, Contact, Shop |
| Employee portal | ✅ Built | Wired to Firebase Auth + Firestore |
| Client portal | ✅ Built | Dashboard, Invoices, Daily Reports |
| Admin portal | ✅ Built | Overview, Employees, Complaints |
| Cloud Functions backend | ✅ Scaffolded | Full API in `firebase/functions/src/` |
| Firestore security rules | ✅ Written | `firebase/firestore.rules` — 15 collections |
| Rule unit tests | ✅ Written | `firebase/test/` — runs against emulator |

**Not yet live** (requires owner Firebase setup):
- Firebase Auth not configured (needs email/password enabled in console)
- No real firebase-config.js (must copy from template and fill values)
- Custom role claims not set on users
- Cloud Functions not deployed
- Database not populated

See [Go-live checklist](#go-live-checklist) below.

---

## Repository structure

```
vagt-website-2026/
├── index.html                  # Home page
├── pages/                      # All HTML pages
│   ├── about.html
│   ├── security.html
│   ├── facilities.html
│   ├── surveillance.html
│   ├── contact.html
│   ├── shop.html
│   ├── portal.html             # Unified login (all roles)
│   ├── employee-portal.html    # Employee dashboard
│   ├── employee-schedule.html  # Employee shift schedule
│   ├── employee-incidents.html # Incident filing
│   ├── client-portal.html      # Client dashboard
│   ├── client-invoices.html    # Client invoices
│   ├── client-reports.html     # Client daily reports
│   ├── admin-portal.html       # Admin overview
│   ├── admin-employees.html    # Employee management
│   ├── admin-complaints.html   # Complaint management
│   └── admin-*.html            # Other admin pages
├── assets/
│   ├── css/main.css            # Shared stylesheet (1,800+ lines)
│   ├── js/
│   │   └── firebase-config-example.js  # Template — copy to firebase-config.js
│   ├── images/logos/
│   └── brochures/
├── firebase/
│   ├── firebase.json
│   ├── .firebaserc
│   ├── firestore.rules         # Security rules for all 15 collections
│   ├── firestore.indexes.json
│   ├── functions/              # Cloud Functions backend
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js        # Express app entrypoint
│   │       └── routes/
│   │           ├── auth.js     # Auth + OTP endpoints
│   │           ├── employee.js # Employee self-service
│   │           ├── client.js   # Client self-service
│   │           └── admin.js    # Admin operations
│   └── test/
│       ├── package.json
│       └── firestore.rules.test.js  # 60+ rule unit tests
├── tests/                      # Python test suite (742 checks)
├── docs/
│   ├── SECURITY_CONTROLS.md
│   └── PLATFORM_SECURITY_OVERVIEW.md
├── API_CONTRACT.md             # Complete backend API specification
├── sitemap.xml
├── robots.txt
└── _headers                    # Cloudflare Pages headers
```

---

## Local development

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Python 3.10+ (for the test suite)
- A Firebase project (use `vagt-security-prod` or create your own)

### 1. Clone and install

```bash
git clone https://github.com/nikhiljha3105/vagt-website-2026.git
cd vagt-website-2026
```

### 2. Configure Firebase

```bash
# Copy the example config
cp assets/js/firebase-config-example.js assets/js/firebase-config.js

# Edit firebase-config.js and fill in your real Firebase project values:
# apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
```

### 3. Install Cloud Functions dependencies

```bash
cd firebase/functions
npm install
```

### 4. Start the Firebase emulator

```bash
# From the repo root
cd firebase
firebase emulators:start --project vagt-security-prod
```

This starts:
- Firestore emulator on port 8080
- Auth emulator on port 9099
- Functions emulator on port 5001
- Hosting on port 5000

Open **http://localhost:5000** to see the site.

### 5. Run the test suite

**Python structural tests** (no emulator needed):
```bash
cd tests
python -m pytest -v
# or: bash run_tests.sh
```

**Firestore rule tests** (emulator required):
```bash
# In one terminal:
cd firebase && firebase emulators:start --only firestore --project vagt-security-prod

# In another terminal:
cd firebase/test && npm install && npm test
```

---

## Deployment

The public website is deployed on **Cloudflare Pages**.

- Every push to `main` triggers a deployment
- Headers defined in `_headers` are applied automatically
- No build step needed (pure HTML/CSS/JS)

**Cloud Functions** (not yet deployed):
```bash
cd firebase
firebase deploy --only functions --project vagt-security-prod
```

**Firestore rules**:
```bash
cd firebase
firebase deploy --only firestore:rules --project vagt-security-prod
```

---

## Firebase setup (required before portals go live)

### In the Firebase Console

1. **Authentication** → Sign-in method → Enable **Email/Password**
2. **Authentication** → Users → Add your first admin user
3. After adding users, set custom role claims via the Admin SDK:

```javascript
// Run once in Firebase Admin SDK or Cloud Shell
const admin = require('firebase-admin');
admin.initializeApp();

// Set admin role
await admin.auth().setCustomUserClaims('<admin-uid>', { role: 'admin' });

// Set employee role
await admin.auth().setCustomUserClaims('<employee-uid>', { role: 'employee' });

// Set client role
await admin.auth().setCustomUserClaims('<client-uid>', { role: 'client' });
```

4. **Firestore** → Create database in production mode
5. Deploy security rules: `firebase deploy --only firestore:rules`

### Firestore initial data

Seed the first employee document (replace `<uid>` with the Firebase Auth UID):

```javascript
db.collection('employees').doc('<uid>').set({
  name: 'Employee Name',
  employee_id: 'VAGT-0001',
  phone: '+91XXXXXXXXXX',
  email: 'employee@vagtsecurityservices.com',
  site_name: 'Site Name, City',
  status: 'active',
  leave_balance: { casual: 6, sick: 4, earned: 2 },
  site_ids: [],
  joined_at: new Date(),
});
```

---

## Security

### Controls in place (10/10)

| # | Control | Details |
|---|---------|---------|
| 1 | HTTP security headers | CSP, X-Frame-Options, nosniff via `_headers` |
| 2 | CSP meta fallback | On every HTML page |
| 3 | Portal noindex | All portal pages excluded from search |
| 4 | Portals require auth | Firebase Auth guards on every portal page |
| 5 | No-cache on portals | Cache-Control: no-store |
| 6 | .gitignore secrets | firebase-config.js, .env excluded |
| 7 | Automated secret scanning | tests/test_security.py |
| 8 | Firestore RBAC | Role-based rules on all 15 collections |
| 9 | Link integrity testing | 196 internal links verified |
| 10 | Sitemap integrity | No portal URLs leak to search engines |

### Open security item

**INC-001**: A Firebase API key was accidentally committed to git history in commit `dd5fd03`.

**Owner action required:**
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Delete/rotate the exposed key
3. Check Cloud Logging for any abuse
4. Rewrite git history to remove the commit (contact the dev team)

See `docs/SECURITY_CONTROLS.md` for full incident details.

---

## Go-live checklist

Before enabling portal access for real users:

- [ ] Rotate exposed API key (INC-001) — **BLOCKING**
- [ ] Verify no abuse in Cloud Logging
- [ ] Enable Firebase Auth (Email/Password)
- [ ] Set custom role claims on all users
- [ ] Deploy Firestore security rules
- [ ] Run Firestore rule unit tests against emulator: all must pass
- [ ] Inject new API key via environment (never hardcode)
- [ ] Deploy Cloud Functions
- [ ] Test employee portal end-to-end with a real account
- [ ] Test client portal end-to-end
- [ ] Test admin portal end-to-end
- [ ] Add contact form rate limiting

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework, no build step) |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore |
| Backend | Firebase Cloud Functions (Node.js 20, Express) |
| Hosting | Cloudflare Pages |
| CDN / Headers | Cloudflare |
| Fonts | Google Fonts (Inter) |
| CI/Testing | Python (pytest), Firebase Emulator + Jest |

---

## Contact

**VAGT Security Services**
- Email: info@vagtsecurityservices.com
- Phone: +91 90089 77711
- Address: Bengaluru, Karnataka, India
