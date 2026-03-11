# VAGT Website — Handoff for Mike
**Last updated:** 2026-03-11 (deployment session)

---

## ⚠️ READ THIS FIRST

You are Mike (or Mike 2, Mike 3, etc.). This file is your briefing. Read it fully before touching any code.

Active branch: `claude/review-website-git-dPWyR`

---

## 🛑 NIKHIL'S STANDING INSTRUCTION — NO NEW BUILDING

**Do not build new features or write new code until Nikhil says otherwise.**

Nikhil wants to walk through the full current experience first before deciding what to build next. Your job right now is **manual tasks only** — things like:

- Answering questions about what's already built
- Cleaning up sensitive files / scripts (see Pending section)
- Revoking service account keys
- Configuring external services (MSG91, NFC tags) when Nikhil is ready
- Running existing scripts if they haven't been run yet

If you find yourself about to write a new route, a new HTML page, or a new feature — **stop and ask Nikhil first**.

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

## What Was Done Today (2026-03-11) — Login debugging session

### Login failure — full diagnosis

Nikhil tried to log in after deployment. It failed. Here is the complete root-cause analysis.

**Symptom:** `POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword — 403 Forbidden`

**Root cause 1 — Fixed ✅:** The Firebase API key had HTTP referrer restrictions in GCP Console that didn't include `vagt---services.web.app`. Fixed by Nikhil in GCP Console → APIs & Services → Credentials → added:
- `https://vagt---services.web.app/*`
- `https://vagt---services.firebaseapp.com/*`

Note: GCP takes **1–2 minutes** to propagate this change. Nikhil may have tried logging in before propagation completed. Try again if not already done.

**Root cause 2 — Bug found, NOT yet fixed ⚠️:** The `_headers` file has a broken `connect-src` directive:
```
connect-src 'self' https://api.vagtsecurityservices.com
```
This does NOT include `https://identitytoolkit.googleapis.com` (Firebase Auth). However, **Firebase Hosting does not read the `_headers` file** — that format is Netlify/Vercel only. Firebase Hosting needs headers in `firebase.json`. So this is currently harmless (headers are not being applied at all), but it means **no security headers are being served** in production. Needs fixing — see Known Issues section.

**Root cause 3 — Wrong login URL given:** In the last session I sent Nikhil to `pages/admin-portal.html` directly. That's the dashboard, not the login page. `admin-portal.html` immediately redirects unauthenticated users to `portal.html`, so Nikhil would have ended up at the right place — but it caused confusion. The correct login URL is:

👉 **`https://vagt---services.web.app/pages/portal.html`**

Login flow: `portal.html` → pick role (Admin/Employee/Client) → enter email+password → redirects to correct dashboard.

### Next session — do this first

1. Go to `https://vagt---services.web.app/pages/portal.html`
2. Click **Admin**
3. Enter: `admin@vagtsecurityservices.com` / `Vagt@Admin2026!`
4. If it still fails with 403: check the GCP API key referrer restriction was saved correctly (GCP Console → APIs & Services → Credentials → Browser key → HTTP referrers should show the two web.app domains)
5. If it fails with "Incorrect email or password": the admin account may not exist yet. Check Firebase Console → Authentication → Users. If missing, run `finalize_setup.py` from Mac (see Pending section).

### Localhost referrer restriction — TODO

GCP API key referrer list does not include localhost yet. When testing locally, add:
- `http://localhost:5000/*`

Go to: `https://console.cloud.google.com/apis/credentials?project=vagt---services` → click the Browser key → add under HTTP referrers.

---

## What Was Done Today (2026-03-11) — Deployment session (earlier)

### Deployment unblocked — 3 root causes fixed

1. **`firebase-config.js` was missing** — file was in `.gitignore` by mistake. Client-side Firebase config is not a secret. Removed from `.gitignore`, created with correct API key (`AIzaSyB8jO...`), committed permanently. This will never be lost again.
2. **Wrong project ID everywhere** — `firebase/.firebaserc` and README both had placeholder `vagt-security-prod`. Real project is `vagt---services` (owned by `nkjha3105@gmail.com`). Fixed and committed.
3. **Missing `firestore.indexes.json`** — deploy was failing because file didn't exist. Created empty indexes file and committed.

### Firestore rules deployed ✅
Rules are live on `vagt---services`. Commit `7bd3ac6`.

### Cloud Functions — ONE STEP REMAINING ⚠️
Functions deploy is blocked on **Blaze (pay-as-you-go) plan upgrade**.
Nikhil needs to:
1. Open: `https://console.firebase.google.com/project/vagt---services/usage/details`
2. Click **Modify plan** → select **Blaze** → add billing card
3. Then run in Terminal (from `firebase/` folder, logged in as `nkjha3105@gmail.com`):
   ```
   firebase deploy --only functions --project vagt---services
   ```

### Account clarification
- Firebase project `vagt---services` is owned by `nkjha3105@gmail.com`
- `jha4all@gmail.com` owns a DIFFERENT project `vagt-services` — this is likely a duplicate and can be deleted
- Always deploy with `nkjha3105@gmail.com`

---

## What Was Done Previously (2026-03-10) — UPDATED end-of-security-session

### Lens gap closed — all three portals now consistent

All features that guards can log are now visible to admins (across all sites) and clients (scoped to their own sites). Both lens gaps are fully resolved.

**New backend routes:**
- `GET /api/guest/admin/logs?date=&site_id=` — all visitor entries for any date (admin)
- `GET /api/guest/admin/active` — live "who's on-premises right now" across all sites (admin)
- `GET /api/client/patrol?date=` — patrol scan logs scoped to client's sites
- `GET /api/client/guests?date=` — visitor log scoped to client's sites
- `index.js` updated to pass `requireAdmin` into guestRouter

**New frontend pages:**
- `pages/admin-guests.html` — live stats (active/total/exited), tab between By Date and Active Now, full visitor table with duration
- `pages/client-patrol.html` — today's coverage summary (scans, checkpoints hit, unique guards), date-filtered patrol scan log
- `pages/client-guests.html` — today's visitor stats (on-site/exited/total), date-filtered visitor table with duration

**Sidebar nav updated:**
- Visitor Log link added to all 5 admin sidebar pages (admin-portal, admin-employees, admin-patrol, admin-complaints, admin-guests)
- Beat Patrol + Visitor Log links added to all 5 client sidebar pages (client-portal, client-reports, client-invoices, client-patrol, client-guests)

**All committed and pushed to `claude/review-website-git-dPWyR` (commit `3c627f6`).**

### Security hardening — 5 critical fixes (latest session, commit `4d39dae`)

1. **Insecure OTPs** — All `Math.random()` replaced with `crypto.randomInt()`/`crypto.randomBytes()` for OTPs, reset tokens, registration tokens, temp passwords (auth.js), and ticket IDs (client.js).
2. **Employee ID race condition** — `nextEmployeeId()` now uses a Firestore transaction on `_meta/employee_counter`. Concurrent admin approvals can no longer produce duplicate VAGT-XXXX IDs.
3. **Unbounded dashboard query** — Admin overview was reading ALL employees with no limit. Added `.limit(500)`.
4. **Request size + spam protection** — `express.json({ limit: '1mb' })` added. `actionLimiter` (60 req/min) applied to check-in, checkout, guest entry, and NFC patrol endpoints.
5. **Audit trail** — `logActivity()` now stores `actor_uid` (the admin's Firebase UID) on every admin action: approve, reject, payroll, complaint update, deactivate, keycode generation.

---

## What Was Done Previously (2026-03-09 — 2026-03-10)

### Backend — Cloud Functions (done via mobile session)
Six security and performance fixes committed and pushed:

1. **Plaintext passwords** — passwords no longer stored in Firestore. New flow: register → OTP → disabled Auth account → admin approves → enabled.
2. **OTP leaking to Cloud Logs** — removed 4 `console.info()` calls writing live OTPs to Google Cloud Logging.
3. **N+1 query on pending leaves** — replaced per-leave Firestore reads with single `db.getAll()` batch call.
4. **Unbounded queries** — added `.limit(500)` to employees, clients, sites list endpoints.
5. **Payroll crash for 500+ employees** — payroll now chunks into 499-write batches.
6. **Ghost Auth accounts on rejection** — rejection now deletes the orphaned Firebase Auth account.

### Code Documentation — Cloud Functions annotated (done via desktop session)
All 5 Cloud Functions source files now have plain-English comments throughout.
Commit `d54657e` — pushed to `claude/review-website-git-dPWyR`.
Files annotated:
- `firebase/functions/src/index.js` — request flow, CORS, rate limiter, auth middleware
- `firebase/functions/src/routes/auth.js` — registration/OTP flows, MSG91 integration code
- `firebase/functions/src/routes/admin.js` — approval flow, payroll placeholder warnings, keycode system
- `firebase/functions/src/routes/employee.js` — attendance flow, leave flow, incident escalation, IST/UTC caveat
- `firebase/functions/src/routes/client.js` — complaint flow, Indian FY logic, GST note, deployment summary

### Frontend — Security Audit page (done via desktop session)
- `pages/security-audit.html` fully rebuilt — matches quality of facilities.html and security.html.
- Committed and pushed in commit `a6b240e`.

### Firebase accounts provisioned (done via desktop session)
- 10 Hats Off guard accounts created (`BIZ-HTO-001` through `BIZ-HTO-010`)
- Hats Off client account: `client-hatsoff@vagtsecurityservices.com`
- 10 PVT (Product Verification Test) accounts — 5 employee, 5 client — seeded with realistic dummy data
- Admin account: `admin@vagtsecurityservices.com` / `Vagt@Admin2026!`
- All PVT employee accounts patched to `profileComplete: true`

### Security — API key rotation (done via desktop session)
- Old Firebase API key rotated in Firebase Console
- Git history rewritten across all branches to scrub old key
- Force pushed to GitHub — history is clean

### Coordination fix
- `CLAUDE.md` updated on both branches with mandatory first-action: `git fetch origin && git checkout claude/review-website-git-dPWyR`
- This prevents future Claude instances from reading stale `main` branch

---

## Pending — Next Session Must Start With These

### 1. The 10 Product Questions — LOGGED, NEED NIKHIL'S ANSWERS

These questions were asked by mobile Claude. They are now logged here permanently. **Nikhil has not yet answered them.** Ask him to answer each one at the start of the next session — the answers will determine product priorities.

**Q1. Who is the primary buyer — the person who signs the contract with VAGT?**
Is it an HR manager, a Facilities head, a CXO? This determines what the client portal needs to show front-and-centre (operational data vs. billing vs. compliance reports).
_Answer: [PENDING]_

**Q2. How do guards currently check in?**
Paper registers, WhatsApp, phone call to a supervisor? This tells us whether mobile-first (PWA) matters more than desktop, and whether GPS location verification needs to be part of check-in.
_Answer: [PENDING]_

**Q3. What is the one thing clients complain about most frequently today?**
"I don't know if my guard showed up" is a very different product from "I can't get an invoice on time."
_Answer: [PENDING — guest entry flagged as #1 complaint based on earlier context]_

**Q4. How many guards do you have today, and what's the realistic number in 12 months?**
Affects database design, payroll computation, and whether current Firestore approach holds.
_Answer: [PENDING — currently 10 Hats Off guards onboarded]_

**Q5. Do you handle payroll yourself or does an agency/accountant do it?**
If outsourced → need CSV/Excel export. If in-house → build the computation engine.
_Answer: [PENDING]_

**Q6. What happens when a guard doesn't show up for a shift?**
Is there a standby pool? Who gets notified — client, ops manager, both? Most critical operational edge case.
_Answer: [PENDING]_

**Q7. How do clients currently receive monthly reports and invoices?**
Email PDFs, WhatsApp, or physical? Tells us whether the client portal replaces a workflow or adds to it, and whether PDF generation is urgent.
_Answer: [PENDING]_

**Q8. Any compliance or licensing requirements — PSARA Act, GST invoicing format, EPF/ESI deductions?**
Non-negotiable in India. Will determine exact fields on payslips, invoices, and whether a CA-approved audit trail is needed.
_Answer: [PENDING]_

**Q9. Who will be the full-time admin of this platform on your side?**
You, an operations manager, or a dedicated person? Determines how powerful vs. hand-held the admin portal should be.
_Answer: [PENDING]_

**Q10. What's the one thing this platform must do flawlessly on day one?**
The thing that, if it breaks, you lose a client or an employee. Everything else can be imperfect in v1. That one thing cannot be.
_Answer: [PENDING]_

### 2. Run `finalize_setup.py` (if not done yet)
Nikhil may not have run this script yet. It creates the admin account and patches PVT employees. Script is in the project folder. Run on Mac (not VM — VM has no Google egress).

### 3. Clean up sensitive scripts
After confirming finalize_setup.py ran successfully, delete from the project folder:
- `finalize_setup.py`
- `provision_accounts.py`
- `seed_pvt_data.py`
- `onboard_guards.py`
- Any `*.json` service account files

### 4. Revoke the old service account key
Firebase Console → Project Settings → Service Accounts → find the key used for provisioning scripts → revoke/delete it.

### 5. Wire SMS/OTP delivery
All OTP endpoints are stubbed. MSG91 recommended for India.
Files: `firebase/functions/src/routes/auth.js` — search `// TODO: Send OTP`

### 6. Guest entry module
Not built. Top client complaint.
- New Firestore collection: `guest_logs`
- New route file: `firebase/functions/src/routes/guest.js`
- New UI page: `pages/employee-guests.html`

---

## What Still Needs to Be Built

| Priority | Feature | Status | Blocked on |
|----------|---------|--------|------------|
| 1 | SMS/OTP delivery (MSG91) | Stubbed — not wired | Owner signs up at msg91.com + gets API key + DLT sender ID |
| 2 | Password reset link on approval | Code in `admin.js:167` commented out | SMS above (same blocker) |
| 3 | NFC checkpoint registration | API exists, NFC stickers not arrived | Physical NFC 213 stickers to arrive + admin registers each via `POST /api/patrol/admin/checkpoints` |
| 4 | Selfie check-in | Not designed or built | Product decision needed first |
| 5 | Intelligent Surveillance page | Coming Soon placeholder | Content / product copy |
| ~~2~~ | ~~Guest entry module~~ | ✅ Done | — |
| ~~3~~ | ~~Beat patrol (NFC)~~ | ✅ Done | — |
| ~~6~~ | ~~Admin guest/patrol views~~ | ✅ Done | — |
| ~~7~~ | ~~Client patrol/guest views~~ | ✅ Done | — |

---

## Known Issues / Technical Debt

- **No HTTP security headers in production** — `_headers` file exists but Firebase Hosting ignores it (that format is Netlify/Vercel only). Headers need to be added to `firebase.json` under a `"headers"` key. Until this is done, `X-Frame-Options`, `Content-Security-Policy`, etc. are NOT being served. Fix: copy the rules from `_headers` into `firebase.json` headers format.
- **`localhost` missing from GCP API key referrer list** — add `http://localhost:5000/*` when local testing is needed (GCP Console → APIs & Services → Credentials)
- No input validation library (joi/zod) — manual checks only
- `activity_log` collection unbounded — no TTL or archival
- Denormalized employee/site names — no cleanup on updates
- Firestore composite indexes missing for several filtered queries
- ~~Firebase API key exposed in git history~~ — **RESOLVED 2026-03-09**

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
