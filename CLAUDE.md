# VAGT Security Services — Claude Code Context

Read this at the start of every session to get up to speed instantly.

---

## What This Project Is

A full-stack platform for VAGT Security Services (Bengaluru):
- **Public website** — marketing pages (index.html + pages/)
- **Employee portal** — guards check in/out, view schedule, apply for leave, report incidents
- **Client portal** — clients raise complaints, view invoices and daily reports
- **Admin portal** — manage employees, approve registrations, run payroll, view analytics
- **Backend** — Firebase Cloud Functions (Node 20, Express) in `firebase/functions/src/`
- **Database** — Firestore with 18 collections, role-based access (employee / client / admin)
- **Auth** — Firebase Authentication with custom claims for roles

## Active Branch

`claude/review-website-git-dPWyR`

Always develop on this branch. Push with:
```
git push -u origin claude/review-website-git-dPWyR
```

## Current State (as of 2026-03-09)

### Recently Fixed (committed + pushed)
1. **Plaintext password storage** — Registration no longer stores passwords in Firestore.
   New flow: `register` → store phone/email/OTP only → `verify-otp` creates a disabled
   Firebase Auth account → admin `approve` enables it. Passwords never touch Firestore.
2. **OTP console leaks** — Removed 4 `console.info()` calls that were writing live OTPs
   to Google Cloud Logging (forgot-password, resend-reset-otp, register, resend-otp).
3. **N+1 query** — `GET /admin/pending-leaves` now uses `db.getAll()` batch fetch instead
   of one Firestore read per leave request.
4. **Unbounded queries** — Added `.limit(500)` to employees, clients, sites list endpoints.
5. **Payroll batch limit** — `POST /admin/payroll/run` now chunks into 499-write batches
   to handle >499 active employees without hitting Firebase's batch cap.
6. **Admin reject cleanup** — Rejection now deletes the orphaned Firebase Auth account
   that was created at verify-otp time.

### Still TODO (in priority order)
1. **SMS/OTP delivery** — All OTP endpoints are stubbed. Integrate MSG91 or Twilio.
   Files: `firebase/functions/src/routes/auth.js` — search for `// TODO: Send OTP`
2. **Guest entry module** — Not built at all. Top client complaint. Needs:
   - Firestore collection: `guest_logs`
   - API routes in a new `firebase/functions/src/routes/guest.js`
   - UI in `pages/employee-incidents.html` or a new `pages/employee-guests.html`
3. **Beat patrol / guard tour** — Not built. Second top complaint. GPS checkpoints.
4. **Selfie check-in** — Photo at check-in time. Third top complaint.
5. **Password reset link delivery** — On admin approval, `auth.generatePasswordResetLink(email)`
   is commented out in `admin.js:167`. Uncomment and wire to SMS once SMS is integrated.

## Key Files

| File | Purpose |
|------|---------|
| `firebase/functions/src/index.js` | Express app entry, CORS, rate limiters, middleware |
| `firebase/functions/src/routes/auth.js` | Login, OTP, registration flow |
| `firebase/functions/src/routes/employee.js` | Attendance, leaves, payslips, incidents |
| `firebase/functions/src/routes/client.js` | Complaints, invoices, reports |
| `firebase/functions/src/routes/admin.js` | All admin operations (1,000+ lines) |
| `firebase/firestore.rules` | Security rules — role-based access |
| `assets/css/main.css` | Shared stylesheet (1,800+ lines) |

## Architecture Decisions Made

- **No build step** — pure vanilla HTML/CSS/JS, deployed directly to Firebase Hosting
- **Single Cloud Function** — all routes under one `api` function at `asia-south1` (Mumbai)
- **Role claims** — roles set server-side via Admin SDK, checked in both middleware and Firestore rules
- **Registration flow** — guard self-registers → phone OTP → disabled Auth account created →
  admin approves → account enabled, employee doc created, reset link sent via SMS (TODO)

## Firestore Collections (18 total)

employees, clients, admins, attendance_logs, leave_requests, payslips, shifts,
incidents, complaints, daily_reports, invoices, sites, companies, activity_log,
pending_registrations, guard_keycodes, sign_in_events, password_reset_tokens

## Known Issues / Technical Debt

- No input validation library (joi/zod) — manual checks only
- `activity_log` collection unbounded — no TTL or archival
- Denormalized employee/site names across collections — no cleanup on updates
- Firestore composite indexes missing for several filtered queries
- Firebase API key `REDACTED_OLD_KEY` exposed in git history
  (commit dd5fd03) — needs history rewrite + key rotation before production

## Session Handoff Notes

Update this section when ending a session so the next session picks up cleanly.

**Last worked on:** Security + performance hardening of Cloud Functions
**Next task:** Wire SMS delivery for OTPs (MSG91 recommended for India), then build guest entry module
