# VAGT Security Services — Claude Code Context

> Session setup is automated. A `SessionStart` hook runs `git fetch + checkout + pull` automatically.
> After loading, read `handoff-for-mike.md` for the latest session notes and active TODO list.

---

## What This Project Is

Full-stack platform for VAGT Security Services (Bengaluru).

| Portal | Users |
|--------|-------|
| Public website | Marketing / lead gen |
| Employee portal | Guards — check-in/out, leaves, incidents, guest log, NFC patrol |
| Client portal | Clients — complaints, invoices, reports, patrol/guest views |
| Admin portal | Internal — payroll, approvals, analytics, patrol oversight |

**Stack:** Vanilla HTML/CSS/JS → Firebase Hosting · Cloud Functions (Node 20 + Express) · Firestore · Firebase Auth

**Active branch:** `claude/review-website-git-dPWyR`
**Push with:** `git push -u origin claude/review-website-git-dPWyR`

---

## Key Files

| File | Purpose |
|------|---------|
| `firebase/functions/src/index.js` | Express entry, CORS, rate limiters, middleware, scheduled functions |
| `firebase/functions/src/routes/auth.js` | Login, OTP, registration flow |
| `firebase/functions/src/routes/admin.js` | All admin operations (1,000+ lines) |
| `firebase/functions/src/routes/employee.js` | Attendance, leaves, payslips (PDF), incidents |
| `firebase/functions/src/routes/guest.js` | Guest entry/exit, QR slip, active list |
| `firebase/functions/src/routes/patrol.js` | NFC beat patrol — checkpoints + logs |
| `firebase/functions/src/routes/client.js` | Complaints, invoices, reports |
| `firebase/firestore.rules` | Security rules — role-based access |
| `assets/css/main.css` | Shared stylesheet (~1,800 lines) |
| `pages/employee-guests.html` | Guard-facing guest log + QR slip UI |
| `pages/employee-patrol.html` | Guard-facing NFC beat patrol UI |
| `pages/admin-guests.html` | Admin guest log — live + by-date |
| `pages/client-patrol.html` | Client patrol coverage view |
| `pages/client-guests.html` | Client visitor log view |

---

## Architecture Decisions

- **No build step** — vanilla HTML/CSS/JS deployed directly to Firebase Hosting
- **Single Cloud Function** — all routes under one `api` function at `asia-south1` (Mumbai)
- **Role claims** — set server-side via Admin SDK; checked in middleware and Firestore rules
- **Registration flow** — guard self-registers → phone OTP → disabled Auth account → admin approves → account enabled → reset link sent via SMS (SMS not yet wired)

---

## Firestore Collections (21 total)

`employees` `clients` `admins` `attendance_logs` `leave_requests` `payslips` `shifts`
`incidents` `complaints` `daily_reports` `invoices` `sites` `companies` `activity_log`
`pending_registrations` `guard_keycodes` `sign_in_events` `password_reset_tokens`
`guest_logs` `patrol_checkpoints` `patrol_logs`

---

## UI Design Rules — Non-Negotiable

**Guards (employees):** Many are not English-primary (Hindi, Kannada, Tamil, Odia).
- Labels: short and literal. Buttons: say exactly what they do ("Mark Exit" not "Process").
- Error messages: plain language. "Wrong password. Try again." — never "Authentication failed (401)."
- Icons: always paired with text. Never icon-only.
- Multilingual support is a planned feature — design with it in mind.

**Clients:** May be 60+, not tech-savvy. They judge the product in the first 30 seconds.
- Dashboard must answer "Is my guard there right now?" without any clicks.
- Never show empty states without an explanation.
- Complaint flow must feel dignified, not like a support ticket system.

---

## File Handling — Critical Rule

When Nikhil shares any file (PDF, DOCX, XLSX, image, or other format), you MUST:

1. Extract all relevant content from the file immediately
2. Save it to the repo — use `client-briefs/` for client documents, `assets/docs/` for reference material
3. Commit and push before doing anything else with that session

**Never rely on the file being re-uploaded in the next session. It will not be there.**

Filenames should be descriptive and dated: `client-briefs/dsmax-security-requirements-2026-03.md`

---

## Known Technical Debt

- No input validation library (joi/zod) — manual checks only
- `activity_log` collection unbounded — no TTL or archival
- Denormalized employee/site names — no cleanup on updates
- Firestore composite indexes missing for several filtered queries
- No HTTP security headers in production — `_headers` file is ignored by Firebase Hosting; headers need to be added to `firebase.json`
- UI is English-only — multilingual support needed
