# VAGT Website — Handoff for Mike
**Last updated:** 2026-03-15

---

## 🕐 SESSION STATUS — 2026-03-15

**Nikhil hit the Claude Desktop rate limit.** It has now reset.

> **"I will start work in 30 mins from where we had stopped."** — Nikhil

### Where we stopped (this session, 2026-03-15)

All 5 disabled admin pages were rebuilt and pushed in this session:
- `admin-payroll.html` — functional, month nav, run payroll, ₹ totals
- `admin-reports.html` — analytics with period selector, API-backed
- `admin-schedule.html` — shift list, assign shift modal, delete shifts
- `admin-clients.html` — clients + sites tabbed view, expandable rows
- `admin-sites.html` — all-sites view with coverage filter

Nikhil's Mac also pushed 10 more commits on top (sidebar "Manage Admins" nav item added to all pages, admin-portal.html improvements, new `admin-admins.html` page, Firestore indexes, etc.).

**Next action when Nikhil returns:** He will tell you what to work on next. Read the TODO list below and be ready to pick up.

---

## ⚠️ READ THIS FIRST

You are Mike (or Mike 2, Mike 3, etc.). This file is your briefing. Read it fully before touching any code.

Active branch: `claude/review-website-git-dPWyR`

---

## Session Update — 2026-03-13

### All 5 disabled admin pages are now BUILT

| Page | Lines | Status |
|------|-------|--------|
| `admin-payroll.html` | 319 | Built — month nav, stat strip, payroll table, run payroll button |
| `admin-reports.html` | 267 | Built — period selector, attendance by site, SLA compliance, incidents, leave |
| `admin-schedule.html` | 356 | Built — week view, shift table, create shift modal, delete shift |
| `admin-clients.html` | 315 | Built — client list with detail drawer, sites, open tickets |
| `admin-sites.html` | 241 | Built — site list with coverage badges, guard roster, filter by client |

### Bug fixed this session
- **admin-reports.html** was missing `firebase-firestore-compat.js` script tag — added

### Workflow reference created
- `WORKFLOW-REFERENCE-2026-03-13.md` — comprehensive step-by-step reference for ALL platform features across all 4 portals

### Still blocked
- **Admin custom claim** — `set-admin-claim.js` still needs to be run from Mac
- **Deploy** — local changes need `firebase deploy`

---

## What Is This Project?

Full-stack security services platform for **VAGT Security Services (Bengaluru)**.

| Portal | Who uses it |
|--------|-------------|
| Public website | Marketing / lead gen |
| Employee portal | Guards — check-in/out, leaves, incidents |
| Client portal | Clients — complaints, invoices, reports |
| Admin portal | Internal — payroll, approvals, analytics |

**Tech stack:** Vanilla HTML/CSS/JS frontend, Firebase Hosting, Firebase Cloud Functions (Node 20 + Express), Firestore database, Firebase Auth.

---

## What Was Done Today (2026-03-12)

### 1. HTTP Security Headers — now actually live (commit `d9f81a5`)

The `_headers` file was silently ignored by Firebase Hosting (that format is Netlify/Vercel only). All security headers have been moved to `firebase.json` under the `"headers"` key — the correct Firebase Hosting format.

Two bugs fixed during migration:
- **CSP `connect-src`** now includes Firebase Auth domains (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebase.googleapis.com`, `firebaseinstallations.googleapis.com`). The old CSP would have blocked all login attempts once headers went live.
- **`Permissions-Policy: camera`** changed from `camera=()` to `camera=self` — the QR scan feature in `employee-patrol.html` needs camera access.
- Cache-Control `no-store` now covers ALL `/pages/**` (not just the 6 originally listed).

**Headers go live when:** `firebase deploy --only hosting` is run from Mac.

### 2. Three-tier storage strategy (commit `224ce92`)

**Tier 1 — Daily Firestore backup → GCS → iCloud:**
- Added `scheduledFirestoreBackup` Cloud Function (`firebase/functions/src/index.js`)
  - Runs at 02:00 IST every day via Cloud Scheduler
  - Exports entire Firestore to `gs://vagt---services-backups/YYYY-MM-DD/`
  - GCS lifecycle rule: auto-deletes exports older than 30 days
- Added `scripts/sync-backups-to-icloud.sh` — run weekly from Mac, pulls GCS exports to `~/Library/Mobile Documents/.../VAGT-Backups/Firestore/` → iCloud syncs to all Apple devices
- **One-time Mac setup required** (see Pending section)

**Tier 3 — Payslip PDFs now persist in Firebase Storage:**
- `GET /api/payslips/:id/download` (`firebase/functions/src/routes/employee.js`)
  - First download: generates PDF with pdfkit → uploads to `payslips/{id}.pdf` in Firebase Storage → stamps `pdf_path` on Firestore doc
  - Subsequent downloads: serves directly from Storage (no pdfkit overhead)
  - Storage failure is non-fatal — guard still gets their PDF; will retry on next download
- Added `firebase/storage.rules` — defence-in-depth rules for Storage access
- `firebase.json` wired to `storage.rules`

**Tier 2 (partial) — Large files out of git:**
- `.gitignore` now excludes `assets/brochures/*.pdf` and `assets/brochures/*.docx`
- The 35 MB Securitas PDF is still in git *history*. The git history cleanup (`git filter-repo`) must be run from Mac **after** uploading files to Firebase Storage first (see Pending section).

---

## Login Status (unresolved from 2026-03-11)

**Last known state:** Login was failing with a network error before Blaze upgrade.

**Blaze plan:** Now upgraded ✅

**Login URL:** `https://vagt---services.web.app/pages/portal.html`

**Admin credentials:** `admin@vagtsecurityservices.com` / `Vagt@Admin2026!`

**If login fails with 403:** GCP API key referrer restriction not saved → GCP Console → APIs & Services → Credentials → Browser key → HTTP referrers must include `https://vagt---services.web.app/*` and `https://vagt---services.firebaseapp.com/*`

**If login fails with "Incorrect email or password":** Admin account may not exist → check Firebase Console → Authentication → Users. If missing, run `finalize_setup.py` (see Pending).

**If login fails with "Account disabled":** Enable in Firebase Console → Authentication → Users.

---

## Pending — Do These From Mac

### 1. Deploy everything (do this first)

```bash
# From the firebase/ folder, logged in as nkjha3105@gmail.com:
firebase deploy --only functions,hosting,storage --project vagt---services
```

### 2. One-time GCS bucket setup (for Firestore backups)

```bash
gcloud config set project vagt---services

# Create the backup bucket in Mumbai
gsutil mb -l asia-south1 gs://vagt---services-backups

# 30-day auto-delete lifecycle
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":30}}]}' > /tmp/lc.json
gsutil lifecycle set /tmp/lc.json gs://vagt---services-backups
rm /tmp/lc.json

# Grant Cloud Functions service account the needed permissions
SA="vagt---services@appspot.gserviceaccount.com"
gcloud projects add-iam-policy-binding vagt---services \
  --member="serviceAccount:$SA" --role="roles/datastore.importExportAdmin"
gcloud projects add-iam-policy-binding vagt---services \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"
```

After deploying, test the backup by manually triggering it in GCP Console → Cloud Functions → `scheduledFirestoreBackup` → Test.

### 3. Sync backups to iCloud (run weekly)

```bash
bash scripts/sync-backups-to-icloud.sh
```

Or set up the launchd weekly job (template included at bottom of the script).

### 4. Upload brochures to Firebase Storage then clean git history

```bash
# Upload brochures first (so the links aren't broken after history cleanup)
gsutil cp assets/brochures/*.pdf  gs://vagt---services.firebasestorage.app/brochures/
gsutil cp assets/brochures/*.docx gs://vagt---services.firebasestorage.app/brochures/

# Then scrub them from git history (this rewrites history — coordinate with team first)
pip install git-filter-repo
git filter-repo --path assets/brochures/ --invert-paths --force

# Force-push the cleaned history
git push --force-with-lease origin claude/review-website-git-dPWyR
```

Note: After removing brochures from git, update any HTML links that reference `assets/brochures/` to use Firebase Storage URLs (`https://firebasestorage.googleapis.com/v0/b/vagt---services.firebasestorage.app/o/brochures%2F...`).

### 5. Run `finalize_setup.py` (if not done yet)

Creates the admin account and patches PVT employees. Run on Mac (not VM).

### 6. Clean up sensitive scripts (after step 5 confirmed)

Delete from project folder:
- `finalize_setup.py`
- `provision_accounts.py`
- `seed_pvt_data.py`
- `onboard_guards.py`
- Any `*.json` service account files

### 7. Revoke old service account key

Firebase Console → Project Settings → Service Accounts → delete the key used for provisioning scripts.

### 8. Add localhost to GCP API key referrers (for local testing)

GCP Console → APIs & Services → Credentials → Browser key → add `http://localhost:5000/*`

### 9. Wire SMS/OTP delivery (blocked on Nikhil signing up at msg91.com)

All OTP endpoints are stubbed. `firebase/functions/src/routes/auth.js` — search `// TODO: Send OTP`.

---

## The 10 Product Questions — NEED NIKHIL'S ANSWERS

These determine product priorities. Not yet answered.

**Q1.** Who is the primary buyer — HR manager, Facilities head, CXO?
*Answer: [PENDING]*

**Q2.** How do guards currently check in — paper, WhatsApp, phone call?
*Answer: [PENDING]*

**Q3.** What is the one thing clients complain about most frequently today?
*Answer: [PENDING — guest entry flagged as #1 based on earlier context]*

**Q4.** How many guards today, and realistic number in 12 months?
*Answer: [PENDING — currently 10 Hats Off guards onboarded]*

**Q5.** Payroll in-house or outsourced to accountant?
*Answer: [PENDING]*

**Q6.** What happens when a guard doesn't show up for a shift?
*Answer: [PENDING]*

**Q7.** How do clients currently receive monthly reports and invoices?
*Answer: [PENDING]*

**Q8.** Any compliance requirements — PSARA Act, GST invoicing, EPF/ESI?
*Answer: [PENDING]*

**Q9.** Who will be the full-time admin of this platform on Nikhil's side?
*Answer: [PENDING]*

**Q10.** What's the one thing this platform must do flawlessly on day one?
*Answer: [PENDING]*

---

## What Still Needs to Be Built

| Priority | Feature | Status | Blocked on |
|----------|---------|--------|------------|
| 1 | SMS/OTP delivery (MSG91) | Stubbed | Owner signs up at msg91.com + gets API key + DLT sender ID |
| 2 | Password reset link on approval | Code commented out in `admin.js:167` | SMS above |
| 3 | NFC checkpoint registration | API exists, stickers not arrived | Physical NFC 213 stickers + admin registers each via `POST /api/patrol/admin/checkpoints` |
| 4 | Admin patrol log UI | API exists (`GET /api/patrol/admin/logs`), no page yet | — |
| 5 | Selfie check-in | Not designed | Product decision needed |
| 6 | Multilingual UI | Not built | i18n extraction work |

---

## Known Issues / Technical Debt

- **`localhost` missing from GCP API key referrer list** — add `http://localhost:5000/*` when local testing is needed
- `activity_log` collection unbounded — no TTL or archival
- Denormalized employee/site names — no cleanup on updates
- Firestore composite indexes missing for several filtered queries
- No input validation library (joi/zod) — manual checks only
- Git history contains 35 MB Securitas PDF — cleanup pending (see Pending section)

---

## Test Accounts (PVT)

| Email | Password | Role |
|-------|----------|------|
| pvt-emp-001@vagtsecurityservices.com | PvtTest@2026! | employee |
| pvt-emp-002@vagtsecurityservices.com | PvtTest@2026! | employee |
| pvt-emp-003@vagtsecurityservices.com | PvtTest@2026! | employee |
| pvt-emp-004@vagtsecurityservices.com | PvtTest@2026! | employee |
| pvt-emp-005@vagtsecurityservices.com | PvtTest@2026! | employee |
| pvt-cli-001@vagtsecurityservices.com | PvtTest@2026! | client |
| pvt-cli-002@vagtsecurityservices.com | PvtTest@2026! | client |
| pvt-cli-003@vagtsecurityservices.com | PvtTest@2026! | client |
| pvt-cli-004@vagtsecurityservices.com | PvtTest@2026! | client |
| pvt-cli-005@vagtsecurityservices.com | PvtTest@2026! | client |
| admin@vagtsecurityservices.com | Vagt@Admin2026! | admin |

All PVT data tagged `pvt: true` in Firestore — bulk delete when done testing.
