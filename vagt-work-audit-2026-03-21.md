# VAGT Platform — Work Audit
**Generated:** 2026-03-21 (automated scheduled task)
**Branch:** `claude/review-website-git-dPWyR`
**Scope:** All commits on active branch vs `origin/main` (133 files changed, 34,791 insertions)

---

## Section 1 — What Was Committed (Evidence Trail)

Commits in reverse chronological order. Each entry is a plain-English summary of what actually changed.

| Commit | What it did |
|--------|-------------|
| `9408837` | Updated handoff-for-mike.md with full Session 6 summary and pending TODO list |
| `31fd302` | Created `client-briefs/incident-management-audit-2026-03.md` — 300-line audit covering current state, schema gaps, priority build order for incident management |
| `31a7f30` | Built `pages/client-profile-setup.html` — two-step post-login profiling (org type → role) with `POST /api/client/profile` backend endpoint and redirect check in client-portal.html |
| `b0babdb` | Built `pages/employee-profile-setup.html` — role selector grid (10 roles) with site input, `POST /api/employee/profile` endpoint, and redirect check in employee-portal.html |
| `9b8cb16` | Centered and enlarged logo on portal.html and register.html; 3-column flex layout |
| `19428dd` | Added auth header spec comment blocks to portal.html and register.html (documentation only) |
| `f863e0c` | Fixed register.html logo uniformity; renamed "Security Guard" label to "Employee" |
| `310774b` | Added REMINDERS section to handoff: get creds from Akhil for old domain 301, check 2Factor DLT status |
| `eb35171` | Wired dual OTP delivery (SMS via 2Factor.in + email fallback); forced functions redeploy to pick up .env |
| `3d3e3ec` | Added Hindi language toggle on portal.html login page; fixed `todayStr()` bug in dashboard stats |
| `63a355e` | Hotfix: added missing `todayStr()` helper function — admin dashboard stats were silently returning undefined |
| `80ae206` | Session 5 handoff notes — documented strategic pivot (professional ops over MyGate/NoBroker guest territory), HatsOff seed complete, domain fix |
| `a13a8af` | Created `firebase/functions/seed-hatsoff-data.js` — seeds 33 months of real HatsOff Aviation guard rota: 22 guards, 9,242 attendance records, 303 payslips |
| `da35796` | Root-cause documentation: old placeholder API key (`REDACTED_OLD_KEY`) on GitHub Pages was causing all 400 errors |
| `6d1ed35` | Unified login (portal.html), role-aware registration (register.html), patrol + leave API path fixes |
| `d502984` | Added 23 composite Firestore indexes to cover all compound queries — deployed to Firebase |
| `6788e1b` | Client portal fixes: incidents stat, mobile nav, IST date formatting, added `client_uid` field on incidents |
| `b370cfc` | Built `pages/employee-leaves.html` — leave request form with balance check against entitlement |
| `42e717f` | Added TaxHacker-inspired improvement ideas to handoff (float money bugs, payslip loading state, CSV export) |
| `5215b64` | Handoff directive to complete all open TODOs |
| `10d3ca0` | Expanded test data to 10 guards + 3 clients + 10 incidents |
| `5ac1eb3` | Added device recognition + frictionless return login (skip OTP if trusted device) |
| `04048e1` | Fixed 404.html to use actual VAGT logo (missed in bulk replace) |
| `db96a86` | Added severity field to incidents; fixed reference number generation in incident history |
| `c1e73e2` | Created branded staff QR code (`assets/images/vagt-staff-qr.png`) for login/registration |
| `74d7af4` | Added Google Drive scan TODO to handoff |
| `e44356a` | Replaced placeholder logo with actual VAGT logo image across all 32 pages |
| `bf0fbda` | Fixed seed data UID mismatch — mapped test accounts to real Firebase Auth UIDs |
| `9c76272` | Replaced white logo with accurate VAGT brand logo SVG |
| `1880bd7` | Added VAGT logo to portal.html and register.html login pages |
| `e0ccdf5` | Added SMS cost controls: device trust + resend rate limiting |
| `989315c` | Wired 2Factor.in SMS OTP into all 4 auth flows (guard register, guard login, client register, client login) |
| `9c1b156` | Session 3 handoff notes |
| `2e14fd5` | Guard performance analytics: `/api/admin/reports` now returns per-guard attendance rates; admin-reports.html gets colour-coded ranking card |
| `0249850` | Fixed seed script to use deterministic IDs — safe to re-run without creating duplicates |
| `01ea04a` | Expanded seed data from ~20 to 113 documents across 13 collections |
| `163b342` | Visual redesign of admin portal: improved cards, hover states, animations |
| `6e12a51` | Added end-to-end test report (TEST-REPORT-2026-03-16.md) |
| `6f4677a` | Fixed Firestore index for `pending_registrations` query |
| `a85f5a7` | Full platform audit document added (AUDIT-2026-03-15.md) |

**Flags:** No commits appear to reverse earlier work. The logo went through 3 iterations (`1880bd7` → `9c76272` → `e44356a`) — not a reversal, it was progressively refined. The `63a355e` hotfix was genuinely additive, not a revert.

---

## Section 2 — What Is Live and Working Right Now

Based on the last confirmed deploy (Session 5, after `firebase deploy` ran successfully from Nikhil's machine with `www.vagtservices.com` now serving the git codebase):

**Authentication**
- `portal.html` login works for admin, employee, and client roles. Role-based redirect after login is live (`redirectByRole()` → admin-portal / employee-portal / client-portal).
- Guard self-registration flow (`register.html`) is built end-to-end. OTP is sent via 2Factor.in SMS + email fallback. Works when DLT is cleared — **currently blocked: 2Factor DLT sender ID + template not yet verified** (see Section 3).
- Client registration flow (register.html → client path) is built, stored in `pending_registrations`, approved via admin-registrations.html. Same DLT block applies.
- Device recognition / frictionless return login is in the codebase but untested end-to-end in production.

**Admin Portal (all pages built)**
- `admin-portal.html` — overview dashboard with stat strip. Stats (Active Employees, Checked In Today, Open Tickets, Pending Leaves) were showing dashes due to a `todayStr()` bug — **that bug is fixed in the current branch** but may not be deployed yet (see Section 3).
- `admin-employees.html` — employee list, correct (shows 34 total after HatsOff seed).
- `admin-payroll.html` — payroll list + payslip generation.
- `admin-leaves.html` — leave approval/rejection via API (fixed from direct Firestore write).
- `admin-complaints.html` — complaint status update via API (fixed from direct Firestore write).
- `admin-registrations.html` — pending approvals with Guard/Client badges, approve/reject.
- `admin-reports.html` — guard performance ranking with colour-coded attendance bars.
- `admin-guests.html` — admin guest log (live + by-date views).
- `admin-patrol.html` — patrol logs view. API path bug was fixed (was calling wrong route prefix).
- `admin-sites.html`, `admin-clients.html`, `admin-admins.html` — all built and functional.
- `admin-schedule.html` — built.
- **Not built yet:** Admin incident management page (see Section 3).

**Employee Portal**
- `employee-portal.html` — dashboard with redirect check: if `role_detail` not set → `employee-profile-setup.html`.
- `employee-profile-setup.html` — role selector (10 roles) + site input. POST `/api/employee/profile` endpoint live.
- `employee-leaves.html` — leave request form with balance check.
- `employee-incidents.html` — guards can file incidents (10 types, 4 severity levels). High/critical triggers activity log.
- `employee-guests.html` — guest entry/exit + QR slip.
- `employee-patrol.html` — NFC beat patrol check-in UI.
- `employee-schedule.html` — schedule view.

**Client Portal**
- `client-portal.html` — dashboard with redirect check: if `org_type` not set → `client-profile-setup.html`.
- `client-profile-setup.html` — org type (4 tiles) + role dropdown. POST `/api/client/profile` endpoint live.
- `client-complaints.html`, `client-invoices.html`, `client-reports.html` — built.
- `client-patrol.html`, `client-guests.html` — built.
- **Not built yet:** Client incident visibility page (see Section 3).

**Infrastructure**
- Firebase Hosting at `www.vagtservices.com` serving the git codebase ✅
- Apex domain `vagtservices.com` added to Firebase Hosting; DNS A record set at GoDaddy — should be fully propagated by now ✅
- 23 composite Firestore indexes deployed ✅
- Cloud Function IAM fixed (`allUsers` invoker role) ✅
- HatsOff seed data loaded: 22 guards, 9,242 attendance records, 303 payslips ✅
- Admin login confirmed working: `hello@vagtservices.com` / `Vagt@2026Admin` ✅

---

## Section 3 — What Was Promised But Not Yet Built

Crossreferenced against handoff TODOs and session notes:

| Item | Status | Notes |
|------|--------|-------|
| **Admin incident management page** | ❌ Not built | Priority 1 per audit. Guards can file incidents; no admin page to view/filter/action/change status/add notes. |
| **Client incident visibility page** | ❌ Not built | Priority 1 per audit. Clients cannot see incidents at their sites at all. |
| **Photo/video attachments on incidents** | ❌ Not built | Priority 3 per audit. Requires Cloud Storage + signed URLs. |
| **Admin notification on new incidents** | ❌ Not built | Priority 4. Needs MSG91 email + SMS wired. |
| **SMS OTP — DLT verified and working** | ⚠️ Wired but blocked | 2Factor.in API key is in the codebase. DLT sender ID + approved template not verified. Indian operators silently block all OTPs until this is done. Nikhil needs to log into 2factor.in and verify. |
| **Deploy latest branch to Firebase** | ⚠️ Needs Nikhil's machine | Includes: logo fix on auth pages, profile setup pages, `todayStr()` dashboard fix, Hindi toggle, dual OTP. Cannot deploy from this environment — Firebase CLI not available here. |
| **Scan VAGT Google Drive folder** | ❌ Not done | Drive link in handoff: https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf. Session 6 noted this as pending. |
| **Figma IA diagram** | ❌ Not built | Requested in Session 5. Single unified flow diagram showing the platform's prioritised features. Figma MCP is available — can be done next session. |
| **CSV export on admin list views** | ❌ Not built | TaxHacker-inspired item from Session 4. ~10 lines per route backend. Estimated high ROI when enterprise clients ask. |
| **Payslip generation loading state** | ❌ Not built | TaxHacker-inspired. Currently no feedback while PDF builds. Guards think button is broken. |
| **Seed test data** (`node seed-demo-data.js`) | ⚠️ Unclear | HatsOff seed confirmed done (Session 5). Demo seed (113 docs) may or may not have been run — handoff marks it as pending. |
| **Multilingual UI (Hindi, Kannada, Tamil)** | ❌ Not built | Hindi toggle on login page exists. Full i18n extraction not started. |
| **SLA tracking + escalation on incidents** | ❌ Not built | Priority 5 per audit. Not started. |

---

## Section 4 — What Was Dropped or Forgotten

These items appeared in earlier session TODOs and have since disappeared without being completed or explicitly deprioritised:

| Item | Last Seen | What Happened |
|------|-----------|---------------|
| **Delete `admin@vagtsecurityservices.com`** | Sessions 2, 5, 6 handoff | Carried forward 3 sessions. Still in Firebase Auth with no claim. Needs a one-time deletion in Firebase Console. Never completed. |
| **SETUP_PASSPHRASE — move to Firebase env variable** | Session 2 known-broken table | Flagged as hardcoded. Disappeared from later session notes. Still hardcoded in `index.js` per the Session 2 audit. Needs checking. |
| **`activity_log` unbounded — add TTL or archival** | Session 2 known-broken table | Noted as technical debt. Confirmed in CLAUDE.md as known debt. No action taken. Will become a real cost issue at scale. |
| **HTTP security headers (`_headers` file ignored)** | CLAUDE.md tech debt section | Firebase Hosting ignores `_headers`. Headers need to go in `firebase.json`. `_headers` file exists in the repo but is being silently ignored. |
| **Audit money storage for float bugs** | Session 4 TaxHacker notes, marked "Do now" | Listed as "one afternoon" effort, high importance for payroll accuracy. Not done. |
| **Connect vagtservices.com to Firebase** | Session 2 priority #4 | **Completed in Session 5** — this was actually done, just not removed from the "dropped" risk list. |
| **LoRa mesh patrol system — assign to student team** | Session 2 feature table | Spec + flyer done. Student assignment not confirmed. Blocked on Nikhil acting on the recruitment flyer. |
| **`_headers` Cloudflare / security headers** | Sessions 1–2 | Exists as a file but ignored by Firebase Hosting. HSTS, CSP, X-Frame-Options not actually being served. |

---

## Section 5 — Recommended Next 3 Actions (Priority Order)

### 1. Deploy the current branch to Firebase (today, 30 minutes)

**Who does this serve?** Every user — guards, clients, admin. The dashboard `todayStr()` bug means admin stats are showing dashes right now. The profile setup pages and logo fix are also not live.

**Does it work without Nikhil in the loop?** No — Firebase CLI is not available in this environment. Nikhil runs one command from his machine.

**Does it make VAGT harder to replace?** Indirectly — a working dashboard with real stats is what clients and Nikhil's team see every day.

```bash
cd ~/"VAGT New Website Design"
git pull origin claude/review-website-git-dPWyR
firebase deploy --only hosting,functions --project vagt---services
```

---

### 2. Build the admin incident management page (next session, 2–3 hours)

**Who does this serve?** VAGT operations team — this is the entire point of guards filing incidents. Right now incidents go into Firestore and disappear. No one reviews them, no one acts on them, nothing escalates.

**Does it work without Nikhil in the loop?** Yes — this is pure build work. Scope is clear from the `client-briefs/incident-management-audit-2026-03.md` file already committed. The API routes exist.

**Does it make VAGT harder to replace?** Yes — incident management with an audit trail and escalation chain is a core differentiator from a manual WhatsApp-based security service. Without this page, the feature doesn't exist from the client's perspective.

Minimum viable page: filterable incident list (by site, type, severity, status) + detail modal with status change + admin notes field.

---

### 3. Verify 2Factor DLT sender ID (today, 15 minutes, Nikhil only)

**Who does this serve?** Every new guard and client trying to register. Without this, OTP SMS is silently blocked by all Indian operators and registration fails with no clear error.

**Does it work without Nikhil in the loop?** No — requires logging into 2factor.in account. Can't be delegated.

**Does it make VAGT harder to replace?** Not directly, but it unblocks self-service onboarding entirely. Right now every new guard registration requires Nikhil to manually read the OTP from Firestore.

Action: Log into 2factor.in → Sender IDs → verify the VAGT sender ID is approved → check the OTP template is also approved. If not approved, re-submit and expect 1–3 business days.

---

*Report ends. No padding. This is where things stand as of 2026-03-21.*
