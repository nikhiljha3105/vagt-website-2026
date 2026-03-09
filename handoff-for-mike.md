# VAGT Website — Handoff for Mike
**Date:** 2026-03-09

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

## What Was Done Today

Six security and performance issues were found, fixed, committed, and pushed to the active branch.

### 1. Plaintext Passwords in Database — FIXED
Guards' passwords were being saved directly into Firestore (readable by anyone with DB access).

**Fix:** Passwords are now never stored. New flow:
- Guard registers → only phone/email/OTP stored
- OTP verified → a *disabled* Firebase Auth account is created
- Admin approves → account is enabled, employee record created

### 2. OTP Codes Leaking into Cloud Logs — FIXED
Live one-time passwords were being printed to Google Cloud Logging via `console.info()`. Anyone with log access could read them.

**Fix:** Removed 4 logging calls across the auth routes.

### 3. Slow "Pending Leaves" Page (N+1 Query) — FIXED
The admin pending-leaves endpoint was making one database read *per leave request* — so 50 pending leaves = 50 separate DB calls.

**Fix:** Replaced with a single `db.getAll()` batch call.

### 4. Unbounded Database Queries — FIXED
Several list endpoints (employees, clients, sites) had no limit — if the DB grew large, one request could dump the entire collection.

**Fix:** Added `.limit(500)` to all list endpoints.

### 5. Payroll Crash for Large Teams — FIXED
Firebase batches cap at 499 writes. Running payroll for 500+ employees would crash mid-run.

**Fix:** Payroll now automatically chunks into 499-write batches.

### 6. Orphaned Auth Accounts on Rejection — FIXED
When an admin rejected a registration, the disabled Firebase Auth account created at OTP verification was left behind (ghost accounts accumulating).

**Fix:** Rejection now deletes the orphaned Auth account.

---

## What Still Needs to Be Built

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | SMS/OTP delivery (MSG91 or Twilio) | Stubbed — not wired |
| 2 | Guest entry module | Not built at all — top client complaint |
| 3 | Beat patrol / guard tour (GPS) | Not built — second top complaint |
| 4 | Selfie check-in | Not built — third top complaint |
| 5 | Password reset link on approval | Code exists, commented out — needs SMS first |

---

## Known Risk (Needs Attention Before Go-Live)

~~Firebase API key exposed in git history~~ — **RESOLVED 2026-03-09**: key rotated in Firebase Console + git history rewritten and force-pushed across all branches.

---

## Active Branch

`claude/review-website-git-dPWyR`

All today's fixes are committed and pushed to this branch.

---

## Next Session Should Start With

Wire SMS delivery for OTPs (MSG91 is recommended for India), then build the guest entry module.
