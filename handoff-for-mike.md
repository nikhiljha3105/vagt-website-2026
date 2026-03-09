# VAGT Website — Handoff for Mike
**Last updated:** 2026-03-09 (end of day)

---

## ⚠️ READ THIS FIRST

You are Mike (or Mike 2, Mike 3, etc.). This file is your briefing. Read it fully before touching any code.

Active branch: `claude/review-website-git-dPWyR`

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

## What Was Done Today (2026-03-09)

### Backend — Cloud Functions (done via mobile session)
Six security and performance fixes committed and pushed:

1. **Plaintext passwords** — passwords no longer stored in Firestore. New flow: register → OTP → disabled Auth account → admin approves → enabled.
2. **OTP leaking to Cloud Logs** — removed 4 `console.info()` calls writing live OTPs to Google Cloud Logging.
3. **N+1 query on pending leaves** — replaced per-leave Firestore reads with single `db.getAll()` batch call.
4. **Unbounded queries** — added `.limit(500)` to employees, clients, sites list endpoints.
5. **Payroll crash for 500+ employees** — payroll now chunks into 499-write batches.
6. **Ghost Auth accounts on rejection** — rejection now deletes the orphaned Firebase Auth account.

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

### 1. The 10 Questions (UNKNOWN — HIGH PRIORITY)
Nikhil has 10 questions from earlier mobile sessions that have **never been addressed**. He has mentioned them twice but not yet pasted them. **Ask Nikhil to paste these first thing.**

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

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | SMS/OTP delivery (MSG91) | Stubbed — not wired |
| 2 | Guest entry module | Not built — top client complaint |
| 3 | Beat patrol / guard tour (GPS) | Not built — second top complaint |
| 4 | Selfie check-in | Not built — third top complaint |
| 5 | Password reset link on approval | Code exists, commented out — needs SMS first |
| 6 | Wire "Add Employee" admin form | Needs Cloud Function — can't create Auth accounts client-side |
| 7 | Intelligent Surveillance page | Currently a Coming Soon placeholder |

---

## Known Issues / Technical Debt

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
