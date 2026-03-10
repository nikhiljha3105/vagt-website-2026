# VAGT Security Services — Claude Code Context

Read this at the start of every session to get up to speed instantly.

---

## ⚠️ FIRST ACTION — Every Session, No Exceptions

Before reading any file or doing any work, run these two commands:

```bash
git fetch origin
git checkout claude/review-website-git-dPWyR
```

All active development happens on this branch. `main` is behind. If you read files from `main` you will have stale context and waste Nikhil's time.

After checking out, read `handoff-for-mike.md` in the project root — it contains the latest session notes.

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

## Current State (as of 2026-03-10)

### Recently Fixed (committed + pushed — 2026-03-09)
1. **Plaintext password storage** — Registration no longer stores passwords in Firestore.
2. **OTP console leaks** — Removed 4 `console.info()` calls leaking OTPs to Cloud Logging.
3. **N+1 query** — `GET /admin/pending-leaves` uses `db.getAll()` batch fetch.
4. **Unbounded queries** — Added `.limit(500)` to list endpoints.
5. **Payroll batch limit** — `POST /admin/payroll/run` chunks into 499-write batches.
6. **Admin reject cleanup** — Rejection deletes orphaned Firebase Auth account.

### Built this session (2026-03-10)
7. **Guest entry module** — Full stack: `firebase/functions/src/routes/guest.js`,
   `pages/employee-guests.html`. Guard logs visitor → QR slip printed → 8-hour expiry.
   - Firestore collection: `guest_logs`
   - Scheduled Cloud Function `expireGuestLogs` (hourly) auto-expires active entries
   - Token format: 8-char hex (e.g. `A3F9C12B`). QR generated server-side via `qrcode` pkg.
   - Exit: guard marks exit inline or by typing token. Slip modal supports browser Print.
8. **Beat patrol (NFC)** — Full stack: `firebase/functions/src/routes/patrol.js`,
   `pages/employee-patrol.html`. Guard taps NFC tag → checkpoint logged.
   - Firestore collections: `patrol_checkpoints`, `patrol_logs`
   - Uses Web NFC API (NDEFReader) — Android Chrome 89+ only
   - Admin registers checkpoints via `POST /api/patrol/admin/checkpoints` (label + nfc_tag_id)
   - Guard sees today's scan log and checkpoint list on the page
   - **Action required**: Order NFC 213 stickers (Amazon/Flipkart). Once arrived, admin registers
     each tag ID in Firestore via the API before guards can scan.
9. **Payslip PDF download** — `GET /api/payslips/:id/download` generates a branded PDF
   on-demand using `pdfkit`. No Cloud Storage needed. Returns `application/pdf` attachment.
10. **Mobile nav bug fixed** — Hamburger button now only appears on screens < 900px.
    Previously showed on all screens after auth load.

### Dependencies added (run `npm install` in `firebase/functions/`)
- `qrcode ^1.5.4` — server-side QR PNG generation
- `pdfkit ^0.15.0` — in-memory PDF generation for payslips

### Still TODO (in priority order)
1. **SMS/OTP delivery** — All OTP endpoints are stubbed. Integrate MSG91.
   **Blocked on**: owner signing up at msg91.com + getting API key + DLT sender ID.
   Files: `firebase/functions/src/routes/auth.js` — search for `// TODO: Send OTP`
2. **Password reset link delivery** — On admin approval, `auth.generatePasswordResetLink(email)`
   is commented out in `admin.js:167`. Uncomment and wire to SMS once SMS is integrated.
3. **NFC tags arrival** — Once physical tags arrive, register each checkpoint via:
   `POST /api/patrol/admin/checkpoints` `{ label, nfc_tag_id, site_id, site_name }`
4. **Selfie check-in** — Photo at check-in time. Not yet designed or built.
5. **Admin portal: patrol log view** — Build a UI page in admin portal to view patrol
   logs per site/date/guard (API already exists: `GET /api/patrol/admin/logs`).

## Key Files

| File | Purpose |
|------|---------|
| `firebase/functions/src/index.js` | Express app entry, CORS, rate limiters, middleware, scheduled functions |
| `firebase/functions/src/routes/auth.js` | Login, OTP, registration flow |
| `firebase/functions/src/routes/employee.js` | Attendance, leaves, payslips (+ PDF download), incidents |
| `firebase/functions/src/routes/guest.js` | Guest entry/exit, QR slip, active list |
| `firebase/functions/src/routes/patrol.js` | NFC beat patrol — checkpoints + logs (employee + admin routes) |
| `firebase/functions/src/routes/client.js` | Complaints, invoices, reports |
| `firebase/functions/src/routes/admin.js` | All admin operations (1,000+ lines) |
| `firebase/firestore.rules` | Security rules — role-based access |
| `assets/css/main.css` | Shared stylesheet (1,800+ lines) |
| `pages/employee-guests.html` | Guard-facing guest log + QR slip UI |
| `pages/employee-patrol.html` | Guard-facing NFC beat patrol UI |

## Architecture Decisions Made

- **No build step** — pure vanilla HTML/CSS/JS, deployed directly to Firebase Hosting
- **Single Cloud Function** — all routes under one `api` function at `asia-south1` (Mumbai)
- **Role claims** — roles set server-side via Admin SDK, checked in both middleware and Firestore rules
- **Registration flow** — guard self-registers → phone OTP → disabled Auth account created →
  admin approves → account enabled, employee doc created, reset link sent via SMS (TODO)

## Firestore Collections (20 total)

employees, clients, admins, attendance_logs, leave_requests, payslips, shifts,
incidents, complaints, daily_reports, invoices, sites, companies, activity_log,
pending_registrations, guard_keycodes, sign_in_events, password_reset_tokens,
**guest_logs**, **patrol_checkpoints**, **patrol_logs**

## User Profile — Critical Context for All UI Decisions

**Guards (employees):** Many are not educated in English. Hindi, Kannada, Tamil, Odia are their primary languages.
Implications for every screen you build or edit:
- Labels must be short and literal — no jargon, no abbreviations
- Buttons must say exactly what they do ("Mark Exit" not "Process")
- Error messages must be plain — "Wrong password. Try again." not "Authentication failed (401)"
- Icons must always have text labels — never icon-only
- Multilingual support is a **planned future feature**, not optional forever — design with it in mind

**Clients:** May be 60+ years old, head-strong, not tech-savvy. They judge the product in the first 30 seconds.
Implications:
- Dashboard must answer "Is my guard there right now?" without any clicks
- Avoid empty states — if there's no data, explain why in plain English
- Complaint flow must feel dignified, not like a support ticket system

**Multilingual roadmap (back-burner, do when rate limit allows):**
1. Extract all UI text strings to `assets/js/i18n.js` (one object per language)
2. Add a language selector to the nav bar (EN / हिं / ಕನ್ನ / தமி / ଓଡ଼ )
3. Load correct language on page render
4. Languages needed: English, Hindi, Kannada, Tamil, Odia
5. User manuals already done in EN + HI — see `docs/`

## Known Issues / Technical Debt

- No input validation library (joi/zod) — manual checks only
- `activity_log` collection unbounded — no TTL or archival
- Denormalized employee/site names across collections — no cleanup on updates
- Firestore composite indexes missing for several filtered queries
- ~~Firebase API key exposed in git history~~ — **RESOLVED 2026-03-09**: key rotated + git history rewritten across all branches.
- UI is English-only — multilingual support needed (guards and clients are not English-primary)

## Session Handoff Notes

Update this section when ending a session so the next session picks up cleanly.

**Last worked on:** Guest entry (QR slip), beat patrol (NFC), payslip PDF download, mobile nav fix
**Next task:** Wire SMS delivery for OTPs — owner must sign up at msg91.com first.
Once SMS is wired: uncomment `generatePasswordResetLink` in `admin.js:167`.
After NFC tags arrive: register checkpoints via `POST /api/patrol/admin/checkpoints`.
Future: admin patrol log UI, selfie check-in.
