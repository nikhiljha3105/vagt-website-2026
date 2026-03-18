# VAGT Website — Handoff Notes
**Last updated:** 2026-03-16

---

## Google Drive — VAGT Data Folder

**VAGT Data folder:** https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf
(Created 2026-03-15. Drop all VAGT-related documents here — Claude will scan, categorise, and commit them to the repo automatically.)

### ⏳ TODO — 2026-03-18 (Mike — please complete all of these)
- [ ] **Scan the VAGT Google Drive folder** for any new documents added since last session. Download, save to `client-briefs/` or `assets/docs/`, and commit to the repo. Link: https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf
- [ ] **Deploy to Firebase** — `firebase deploy --only hosting,functions,firestore:indexes --project vagt---services` from your machine
- [ ] **Seed test data** — `node seed-demo-data.js ~/Downloads/<service-account-key>.json` from `firebase/functions/`
- [ ] **Connect vagtservices.com** — Firebase Console → Hosting → Add custom domain
- [ ] **Wire SMS via MSG91** — provide API key + DLT sender ID so OTP delivery can be enabled
- [ ] **Admin patrol log UI** — page needs to be built (API already exists at `/api/admin/patrol`)
- [ ] **Delete old admin account** — `admin@vagtsecurityservices.com` still in Firebase Auth with no claim — remove it

Documents already saved to `client-briefs/` in the repo:
- `tarun-realtors-security-assessment-2025-12.md` — Security audit report for M/s Tarun Realtors (Dec 2025)
- `vagt-brochure-2025.pdf/.docx` — Company brochure
- `vagt-client-list-2025.docx` — Client roster
- `vagt-rota-2026.xlsx` — Guard rotation schedule
- `vagt-security-audit-checklist-2025.pages` — Audit checklist template
- `vagt-security-consultant-questionnaire.xlsx` — Client onboarding questionnaire
- `vagt-lora-project-flyer-2026-03.pdf` — LoRa student project recruitment flyer

---

## 📬 MESSAGE FROM NIKHIL — 2026-03-15

> "Back in 30 mins, picking up from where we stopped."

### Public Website Feedback (via Nikhil, reviewed with AI)

**Immediate fixes:**

| # | Issue | Detail |
|---|-------|--------|
| 1 | **Wrong logo** | Use `VAGT_Security_Services_Front__1_.jpg` exactly. VAGT text also needs to be bigger. |
| 2 | **Sidebar labels** (MAIN, SERVICES, COMPANY) | Too low-contrast/small — increase contrast and font size |
| 3 | **Est. date** | Shows wrong year — fix it |
| 4 | **'g' in VAGT hero** | The security guard silhouette shaped as the 'g' is the core brand idea — preserve it |
| 5 | **Hero text** | "G4S trained" → replace with **"armed forces trained"** |

**Strategic direction (bigger picture):**

- Site currently reads as a **manpower supplier** — needs to read as an **Integrated Security & Risk Management Provider**
- Content: duplicates, grammar issues, not corporate enough — needs full rewrite
- Missing trust signals: PSARA licence, ISO certs, guard headcount, client sectors — enterprise clients will bounce
- Design: needs service cards, guard/operations imagery, clear CTAs
- Careers page: just an email address — needs recruitment pipeline, training info, growth paths
- Security hardening: Cloudflare WAF, HTTP headers (HSTS, CSP, X-Frame-Options), obfuscated emails, CMS 2FA
- SEO: dedicated pages for Industrial Security, Corporate Guarding, Airport Security, Security Services Bangalore

**Proposed phases:**
1. **Phase 1** — Quick wins: grammar, homepage, icons, certs
2. **Phase 2** — Credibility: leadership, scale, careers
3. **Phase 3** — Security hardening: Cloudflare, headers, CMS

---

## Session 3 — 2026-03-16 (overnight/morning)

### What was built / fixed
- `firebase/functions/seed-demo-data.js` — expanded to **113 documents** across 13 collections (3 companies, 3 sites, 10 employees, 24 attendance logs, 7 leave requests, 7 complaints, 5 incidents, 12 guest logs, 6 patrol checkpoints, 10 patrol logs, 5 payslips, 4 invoices, 20 activity entries). All with realistic Bangalore data.
- **Duplicate prevention fix** — all seed `.add()` calls replaced with `.doc(deterministicId).set()`. Re-running the seed no longer creates duplicates. Fixes Suresh Babu leave showing twice.
- **Guard Performance analytics** — `/api/admin/reports` now returns `guard_performance` (was empty `[]`). Per-guard: shifts total, shifts present, attendance rate %, incidents filed. Ranked by attendance rate.
- **admin-reports.html** — new Guard Performance ranking card at the bottom. Color-coded bars (green ≥90%, amber ≥70%, red below 70%).
- All previously reported bugs were already fixed by overnight agents: IST timezone, API direct-write, password field.

### Confirmed already fixed (no work needed)
- `admin-admins.html` password field — already `type="password"` with Show toggle ✅
- `admin-complaints.html` — already calls API, not direct Firestore ✅
- `admin-portal.html` leave approve/reject — already calls API ✅
- `employee.js` `todayStr()` — already IST-corrected ✅

### Deploy steps when you're ready
```bash
# 1. Pull latest
cd ~/Claude/"VAGT New Website Design" && git pull

# 2. Deploy everything
firebase deploy --only hosting,functions,firestore:indexes --project vagt---services

# 3. Seed test data (one-time, from firebase/functions/ directory)
cd firebase/functions
node seed-demo-data.js ~/Downloads/<service-account-key>.json

# To wipe and re-seed cleanly (deterministic IDs mean it's safe to re-run):
node seed-demo-data.js ~/Downloads/<key>.json --wipe
node seed-demo-data.js ~/Downloads/<key>.json
```

### Test credentials (after seeding)
| Portal | Email | Password |
|--------|-------|----------|
| Admin | hello@vagtservices.com | Vagt@2026Admin (change this) |
| Employee | guard001@vagttest.com | TestGuard@001 |
| Client | client001@vagttest.com | TestClient@001 |

OTP for guard registration: check Firestore → `pending_registrations` → doc → `otp` field

---

## 🔧 PENDING — Firebase Deploy (2026-03-16)

Firebase CLI is **not installed** on the server. All code changes from this session are committed and pushed to the branch but **not yet live**.

To deploy when back at your machine:
```bash
npm install -g firebase-tools   # if not already installed
firebase login
firebase deploy --only hosting --project vagt---services
```

All public website changes (homepage reposition, trust strip, sidebar labels, VAGT wordmark size) will go live after this deploy.

---

## ⚠️ READ THIS FIRST

Active branch: `claude/review-website-git-dPWyR`
Push with: `git push -u origin claude/review-website-git-dPWyR`

**Stable rollback tag:** `v0.1.0-admin-login-stable`
To roll back git: `git checkout v0.1.0-admin-login-stable`
Firebase Hosting rollback: Console → Hosting → Release history → Rollback (instant, no git needed).

---

## Session 2 — 2026-03-15 (evening)

### What was built
- `pages/register.html` — guard self-registration (name/phone/email → OTP → success)
- `pages/admin-registrations.html` — admin pending approvals with Approve/Reject buttons
- `pages/portal.html` — "New guard? Create your account →" link added
- `firebase/functions/src/routes/admin.js` — approval now sends Firebase password-reset email automatically (free, no SMS needed)
- `firebase/functions/src/routes/auth.js` — collects `name` field at registration
- All 10 admin pages — "New Registrations" nav link added to sidebar
- `assets/css/main.css` — sidebar text brightness fixed (logo sub, nav links, group labels all much more readable)
- `firebase.json` — region `asia-south1` added to hosting rewrite

### Critical fix applied
**Cloud Function IAM** was blocking ALL API calls with 403/401 — the function wasn't publicly invocable. Fixed by granting `allUsers` the `Cloud Functions Invoker` role in GCP Console. This was the root cause of every API call failing silently.

### Deploy needed
After running `firebase deploy --only hosting,functions`, the full platform is functional for the first time:
- Guard registration flow works end-to-end
- Admin approve/reject works
- Leave approvals via API work
- Complaint status updates via API work

### OTP note
SMS is not wired yet. To test registration: after a guard submits, check Firestore → `pending_registrations` → find the doc → read the `otp` field. Tell the guard the code manually. When MSG91 is ready, swap in the sendSms() call in auth.js — nothing else changes.

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
