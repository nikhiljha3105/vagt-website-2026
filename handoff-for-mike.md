# VAGT Website — Handoff Notes
**Last updated:** 2026-03-15

---

## Google Drive — VAGT Data Folder

**VAGT Data folder:** https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf
(Created 2026-03-15. Drop all VAGT-related documents here — Claude will scan, categorise, and commit them to the repo automatically.)

Documents already saved to `client-briefs/` in the repo:
- `tarun-realtors-security-assessment-2025-12.md` — Security audit report for M/s Tarun Realtors (Dec 2025)
- `vagt-brochure-2025.pdf/.docx` — Company brochure
- `vagt-client-list-2025.docx` — Client roster
- `vagt-rota-2026.xlsx` — Guard rotation schedule
- `vagt-security-audit-checklist-2025.pages` — Audit checklist template
- `vagt-security-consultant-questionnaire.xlsx` — Client onboarding questionnaire
- `vagt-lora-project-flyer-2026-03.pdf` — LoRa student project recruitment flyer

---

## ⚠️ READ THIS FIRST

Active branch: `claude/review-website-git-dPWyR`
Push with: `git push -u origin claude/review-website-git-dPWyR`

**Stable rollback tag:** `v0.1.0-admin-login-stable`
To roll back git: `git checkout v0.1.0-admin-login-stable`
Firebase Hosting rollback: Console → Hosting → Release history → Rollback (instant, no git needed).

---

## Current Status — 2026-03-15

### ✅ Working end-to-end
- Unified staff login at `vagt---services.web.app/pages/portal.html`
- Admin account: `hello@vagtservices.com` / `Vagt@2026Admin` — **change this password**
- Role-based silent redirect after login (admin → admin dashboard, etc.)
- CSP headers correct in `firebase.json`
- Token force-refresh on login so custom claims load immediately
- Firestore composite indexes deployed
- Manage Admins page live
- Stat strips on employees + complaints pages
- All 5 previously-disabled admin pages built and live

### ❌ Known broken / not yet wired
| Issue | File | Fix |
|-------|------|-----|
| Complaints status writes directly to Firestore | admin-complaints.html | Call POST /api/admin/complaints/:id/status |
| Leave approval writes directly to Firestore | admin-portal.html | Call POST /api/admin/leaves/:id/approve |
| Add Admin password shows plaintext | admin-admins.html | type="text" → type="password" |
| SMS not wired | auth.js | Needs MSG91 API key + DLT sender ID |
| Attendance timezone bug | employee.js | todayStr() uses UTC, breaks night shift |
| SETUP_PASSPHRASE hardcoded | index.js | Move to Firebase env variable |
| activity_log unbounded | Firestore | Add TTL or archival |
| vagtservices.com not on Firebase | DNS | Firebase Console → Hosting → Add custom domain |

---

## Version / Rollback Strategy

### Git tags
| Tag | What it represents |
|-----|--------------------|
| v0.1.0-admin-login-stable | Admin login working, CSP fixed, indexes deployed |

Create a new tag after each stable milestone:
  git tag -a v0.x.x-label -m "description"
  git push origin v0.x.x-label

### Firebase Hosting rollback
Firebase Console → Hosting → Release history → click any deploy → Rollback.
Every firebase deploy creates an automatic rollback point.

### Firebase Functions rollback
  git checkout <stable-tag>
  firebase deploy --only functions --project vagt---services
  git checkout claude/review-website-git-dPWyR

---

## Next Priorities (in order)

1. Seed Firestore with test data (2-3 employees, 1 complaint, 1 leave request, 1 client)
2. Fix Firestore direct-write bugs in admin-complaints.html and admin-portal.html
3. Fix Add Admin password field (one-line change)
4. Connect vagtservices.com to Firebase Hosting
5. Wire SMS via MSG91

---

## Admin Credentials (live)

| Email | Password | Notes |
|-------|----------|-------|
| hello@vagtservices.com | Vagt@2026Admin | Change this immediately |

Old account admin@vagtsecurityservices.com still in Firebase Auth — no claim, no inbox. Delete it.

---

## What Still Needs to Be Built

| Priority | Feature | Status | Blocked on |
|----------|---------|--------|------------|
| 1 | SMS/OTP delivery | Stubbed | MSG91 API key + DLT sender ID |
| 2 | Password reset on guard approval | Commented out | SMS above |
| 3 | NFC checkpoint registration | API exists | Physical NFC 213 stickers |
| 4 | Admin patrol log UI | API exists, no page | — |
| 5 | Multilingual UI | Not built | i18n extraction |
| 6 | IST timezone fix in attendance | One-line fix | — |
| 7 | LoRa mesh patrol system | Spec + flyer done | Assign to final-year student team (3 ECE + 1 CSE, fully funded) |

---

## Key Files

| File | Purpose |
|------|---------|
| firebase/functions/src/index.js | Express entry, CORS, rate limiters, scheduled functions |
| firebase/functions/src/routes/auth.js | Login, OTP, registration |
| firebase/functions/src/routes/admin.js | All admin operations |
| firebase/functions/src/routes/employee.js | Attendance, leaves, payslips |
| firebase/functions/src/routes/guest.js | Guest entry/exit |
| firebase/functions/src/routes/patrol.js | NFC beat patrol |
| firebase/functions/src/routes/client.js | Complaints, invoices, reports |
| firebase/firestore.rules | Role-based Firestore access |
| firebase/firestore.indexes.json | Composite indexes (deployed) |
| firebase.json | Hosting config, CSP headers, rewrites |
| assets/css/main.css | Shared stylesheet |
