# VAGT Website — Handoff Notes
**Last updated:** 2026-03-21

---

## Session 7 — 2026-03-21

### What was done this session

#### Bug fixes (admin portal audit)

- **`pages/admin-portal.html`**
  - Removed duplicate `todayStr()` — first version used local timezone (wrong), second (kept) uses `en-CA` + `Asia/Kolkata` IST (correct).
  - Fixed `firstName` fallback: `displayName.split(' ')[0] || 'Admin'` — no longer crashes if display name has no spaces.
  - Fixed Firestore Timestamp rendering in leave dates dashboard widget — was showing raw `Timestamp(seconds=..., nanoseconds=...)` string. Now calls `.toDate().toLocaleDateString('en-IN')` guarded by null/type check.

- **`pages/admin-employees.html`**
  - Fixed `getIdTokenResult()` → `getIdTokenResult(true)` to force-refresh custom claims on page load. Without this, newly approved guards wouldn't get their role recognised until they cleared cache.

- **`pages/admin-leaves.html`**
  - Both `approveLeave` and `rejectLeave` had generic `throw new Error('Server error')` on non-OK responses. Fixed both to parse the JSON error body: `const d = await resp.json().catch(() => ({})); throw new Error(d.message || 'Server error')`.

- **`pages/admin-incidents.html`**
  - Added `firebase.apps.length === 0` guard before `initializeApp()` to prevent double-init crash.
  - Changed `toLocaleDateString` → `toLocaleString` (replace_all) so incident timestamps show both date and time, not just date.

#### Incidents nav link added to all 14 pages

Python script inserted `<a href="admin-incidents.html" class="nav-link">Incidents</a>` (with shield+warning SVG icon) into **10 admin pages**: admin-portal, admin-registrations, admin-payroll, admin-reports, admin-guests, admin-patrol, admin-sites, admin-clients, admin-admins, admin-schedule.

Same script inserted `<a href="client-incidents.html" class="nav-link">Incidents</a>` into **6 client pages**: client-portal, client-patrol, client-guests, client-reports, client-complaints, client-invoices.

#### `pages/client-incidents.html` — NEW FILE built

Read-only client-facing incident view. Full page:
- Auth: Firebase Auth + `getIdTokenResult(true)` checks `role === 'client'`. Redirects to `portal.html` if not authenticated.
- Firestore query: `db.collection('incidents').where('client_uid', '==', uid).orderBy('submitted_at', 'desc').limit(100)`
- Stat strip: Total, Open, Resolved, High/Critical counts
- Filter bar: status, severity, date range (default last 30 days)
- Incident cards with severity-coded left border (`.incident-card.critical`, `.incident-card.high`, `.incident-card.resolved`)
- Shows admin resolution notes (`admin_notes`) when status is `resolved`
- `firebase.apps.length === 0` guard on init

#### `firebase/functions/src/routes/client.js` — field name bug fixed

The dashboard incident count query was using `site_client_uid` (field doesn't exist). The actual field name set by `employee.js` at incident creation is `client_uid`. Fixed the where clause — was always returning 0 incidents on the client dashboard. ✅

#### `firebase/firestore.rules` — client read access for incidents

Added rule so clients can read incident documents where `client_uid == request.auth.uid`:
```
allow read: if isAnyClient()
  && resource.data.client_uid == request.auth.uid;
```

#### All changes committed

Commit: `c8c667a` — "Fix admin portal bugs + build client-incidents.html"
Branch: `claude/review-website-git-dPWyR`

---

### Shop strategy — discussed and paused commodity build

Nikhil wants to add security products to the shop: bullet camera, IP camera, CCTV monitor, DVR, metal detector, Motorola DP2400e radio (rebranded as "International Brand" not "UK"). Commerce flow agreed:
- **Indian stocked goods** (cameras, DVR, metal detector): Razorpay checkout (no volume minimum, 2% fee) + bank transfer fallback
- **International products** (radios): quote-only via WhatsApp — too many variables (USD conversion, conversion fee, margin, shipping, bank charges)
- **Vendor complaints**: go directly to vendor with Nikhil CC'd — automated, not manual

**Decision to pause commodity build** — market research revealed:
- Commodity products (Hikvision, CP Plus equivalent cameras, metal detectors) have thin/zero margin at VAGT's volume
- **STQC mandate (April 2025)**: Only CP Plus, Sparsh, Matrix Comsec, and Prama India are approved for government/regulated sites. Hikvision, Axis, and all others are frozen out.
- **WPC approval required** for all radio devices sold in India — Motorola DP2400e is compliant but import/resale requires WPC licence
- **DPDPA** — biometric/facial recognition data must stay in India-based cloud

---

### Market research completed — Notion page created

Full market research doc created in Notion: **"🔬 VAGT Shop — Market Research & Strategy"**
URL: https://www.notion.so/32a9d914b02f81fc8a6deb5edc8f3d7e

Key findings:
- Commodity CCTV/metal detectors: 0–5% margin — not worth it
- Premium niche where clients pay 2x+: **ANPR**, AI video analytics, smart intercoms, access control, LoRa mesh patrol
- Real opportunity: integrated services with recurring SaaS revenue, not one-time hardware sales
- Indian competitors (Zicom, Securens, BEL) do hardware resale — VAGT's edge is the software platform + guard management layer

Decision framework captured: build vs resell vs partner matrix, commerce automation requirements, international product handling, vendor complaint routing. All in Notion.

---

### ANPR + Vahan WhatsApp bot — product concept designed

New product concept fully designed this session:

**The problem:** Gated societies with unmanned gates have illegal parking and bike sneaking. ANPR boom barrier solves it, but the pitch needs a free hook.

**The hook — Free WhatsApp vehicle lookup bot:**
- Society residents WhatsApp any vehicle plate number
- Bot queries MoRTH Vahan 4.0 database (public under Section 62 Motor Vehicles Act) via commercial API (IDfy/Karza/AuthBridge — ₹2–5 per query)
- Returns: Owner name, vehicle type, registration state, insurance validity, fitness cert, blacklist status
- Logs query + number to Firestore `vehicle_lookups` collection
- Delivered via WhatsApp Business API (Interakt recommended — best India pricing + Firestore webhook support)

**Why free:**
- Zero cost to resident, zero effort from VAGT after setup
- Every query is a lead — the person who looks up a plate is exactly who buys ANPR
- Free tool = word of mouth in society WhatsApp groups
- When society gets 200 queries/month, the conversation becomes "want to automate this?"

**Revenue model:**
- Free bot: ₹0, pure lead gen
- ANPR install: ₹80,000–1,50,000 one-time + ₹3,000–5,000/month maintenance
- AI analytics add-on: ₹2,000–4,000/month SaaS per camera
- Smart intercom: ₹15,000–30,000 one-time

**Tech stack:** Firebase Cloud Functions (existing) + IDfy Vahan API + Interakt WhatsApp webhook. Logs to new `vehicle_lookups` Firestore collection. Bot handles unknown commands gracefully with help text.

Full architecture added to Notion page.

---

### Built later in Session 7 (same date)

#### My Profile pages — all three portals

- `pages/employee-my-profile.html` — Guard can edit name, phone, upload profile photo
- `pages/client-my-profile.html` — Client can edit name, phone, upload profile photo, view org read-only
- `pages/admin-my-profile.html` — Admin can edit display name, upload profile photo, change password via reset flow

Photo upload: Canvas → WebP 85% quality, max 400px → Firebase Storage `profile_photos/{uid}.webp` → URL saved to Firestore doc. No backend changes needed (Firestore rules already allow users to write their own doc).

My Profile nav link added to all 26 portal pages via Python script.

Also: `admin-payroll.html` — improved Run Payroll error messages. Now shows HTTP status code + actionable hint (404 = not deployed, 500 = check logs).

#### Finance & Inventory — admin-finance.html (NEW)

Full finance management page for admin portal:
- **Documents tab**: Upload receipts/bills/invoices. Client-side WebP compression (max 1200px, 82% quality — 4MB → ~120KB). Image stored in Firebase Storage. Status: complete / incomplete / processing. Filter by status/type/category/search. Click document → detail modal → edit all fields → change log tracks every field edit (actor, old value, new value, timestamp).
- **Inventory tab**: Guard Uniforms + Facility Items. Auto-seeds 7+7 default items (stock=0) on first load. Adjust Stock modal: purchase/issue/return/adjustment. Atomic increment, full transaction log. Reorder alerts when stock ≤ reorder level. Add custom items on the fly.

New Firestore collections: `financial_documents`, `document_changes`, `inventory_items`, `inventory_transactions`. Admin-only rules added to `firestore.rules`.

Finance & Inventory nav link added to all 14 admin pages.

**OCR pipeline ready to wire (Phase 2):**
- After upload, call Cloud Function `POST /api/admin/finance/extract` with storage URL
- Cloud Function calls Gemini 1.5 Flash → returns structured fields
- Set `status: 'processing'` → `status: 'complete'/'incomplete'` based on confidence
- Needs: Gemini API enabled in GCP Console + `GEMINI_API_KEY` in Functions config

#### Gate Automation product strategy captured

Documented in Notion (https://www.notion.so/32a9d914b02f81fc8a6deb5edc8f3d7e):
- FAAC (Italian, #1 globally, UK subsidiary in Basingstoke) → approach for South India distribution rights via UK entity
- Paxton Access (UK, pure British) → complementary brand for access control layer
- VAGT's own team installs → needs FAAC factory certification before first commercial install
- Phase 2: gate events → Firestore `gate_events` → client portal widget (~4-6 hours dev, starts after first install)

#### Version tag

`v0.7.0-pre-finance-profile` — pushed to origin before this build started. Clean rollback point.

---

### Pending from this session (carry forward)

- [ ] **Firebase deploy** — `firebase deploy --only hosting,functions,firestore:rules --project vagt---services` (from Nikhil's machine — all Session 7 changes including profile pages, finance tool, Firestore rules)
- [ ] **Finance OCR wiring (Phase 2)**:
  - Enable Gemini API in GCP Console (same project)
  - Add `GEMINI_API_KEY` to Firebase Functions config
  - Build `POST /api/admin/finance/extract` Cloud Function
  - Wire to finance page upload flow
- [ ] **iCloud backup script**: cron job to export Firestore + Storage → iCloud Drive monthly
- [ ] **Shop build** (resuming after strategy pause):
  - Add 6 products: bullet cam, IP cam, CCTV monitor, DVR, metal detector, Motorola DP2400e radio (label: International Brand)
  - Add enquiry capture modal with Firestore logging to `shop_enquiries`
  - Update product filter button
  - Rename "Imported from UK" → "International Brand" on existing items
- [ ] **Admin shop enquiries dashboard widget** + `admin-shop-enquiries.html` page
- [ ] **WhatsApp Vahan lookup bot:**
  - Sign up with IDfy or Karza for Vahan API access (₹2–5/query)
  - Sign up with Interakt for WhatsApp Business API
  - Build Cloud Function webhook handler + `vehicle_lookups` Firestore collection + rules
  - Pick 3 pilot societies from existing guard contracts for free rollout
- [ ] **Gate automation**: Email FAAC UK (faac.co.uk) + Paxton Access (paxton.co.uk) for India distribution rights. Use UK entity.
- [ ] **Razorpay signup** — no minimum volume, needs GST + PAN + bank account
- [ ] **Node 18 → 22 upgrade** — Firebase deadline April 2026 (Node 18 EOL)
- [ ] From earlier: **SMS/MSG91 DLT registration**, **delete `admin@vagtsecurityservices.com`** from Firebase Auth

---

## Session 6 — 2026-03-20 (afternoon/evening)

### What was done this session

- **Logo centered and enlarged on auth pages:** Portal and register pages now use 3-column layout (left spacer, centered 48px logo, right spacer). Spec comment blocks updated. ✅
- **Employee progressive profiling page created:** `pages/employee-profile-setup.html` with role selector grid (10 roles: Security Guard, Security Officer, Facility Officer, Housekeeper, Facility Manager, Electrician, Plumber, Office Boy, Operations Manager, Operations Director). Site input revealed after role selection. ✅
- **Employee profile endpoint added:** `POST /api/employee/profile` saves role_detail and primary_site to employees doc. ✅
- **Employee portal redirect check:** Added check in employee-portal.html — if role_detail not set, redirects to employee-profile-setup.html. ✅
- **Client progressive profiling page created:** `pages/client-profile-setup.html` with two-step flow: Step 1 = org type selector (4 full-width tiles), Step 2 = role dropdown (dynamically populated per org type). Org types: Residential Society, Builder/Developer, Facility Management Company, Corporate/Office. ✅
- **Client profile endpoint added:** `POST /api/client/profile` saves org_type and org_role to clients doc. ✅
- **Client portal redirect check:** Added check in client-portal.html — if org_type not set, redirects to client-profile-setup.html. ✅
- **Incident management audit completed:** Comprehensive audit document created (`client-briefs/incident-management-audit-2026-03.md`) documenting current state, gaps, schema, and priority build order. ✅

### Key findings from incident audit

- **What works:** Guards can file incidents (10 types, 4 severity levels). High/critical incidents trigger activity log with ⚠️ prefix.
- **What's missing:** Admin page to action incidents, client visibility of incidents, photo attachments, real-time notifications (SMS/email), SLA tracking, escalation.
- **Priority 1 (critical):** Build admin incident management page (view, filter, change status, add notes).
- **Priority 2 (critical):** Build client incident visibility page.
- **Priority 3 (high):** Photo/video attachment support.
- **Priority 4 (high):** Admin notification (email + SMS via MSG91).
- **Priority 5 (medium):** SLA tracking + escalation.

---

## Google Drive — VAGT Data Folder

**VAGT Data folder:** https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf
(Created 2026-03-15. Drop all VAGT-related documents here — Claude will scan, categorise, and commit them to the repo automatically.)

---

## 🔔 REMINDERS FOR NIKHIL
- **Get login creds from Akhil** for vagtsecurityservices.com — needed to set up 301 redirect to vagtservices.com
- **2Factor DLT check**: Log into 2factor.in → verify DLT sender ID + approved template. Without DLT, Indian operators silently block all OTPs regardless of API key being valid.

---

## Session 5 — 2026-03-21 (evening)

### Strategic pivot — discussed this session

Nikhil's father raised a key point: **MyGate and NoBroker already own society guest entry and visitor management**. VAGT's defensible edge is on the **professional security operations side**:

- ✅ Beat patrol with GPS/NFC proof-of-presence
- ✅ Incident management with escalation chains
- ✅ Audit trails (who was where, when, for how long)
- ✅ Guard accountability (attendance, OT, leave, performance ranking)
- ✅ Client-facing compliance reporting

**Next session should begin with a strategic UX/IA session** — map what the platform should prioritise, deprioritise, and potentially cut. A Figma IA diagram was requested to show the clean unified flow.

---

### What was done this session

- **Root cause of 400 errors found and fixed**: `vagtservices.com` was pointing to GitHub Pages (old pre-git codebase with `apiKey: "REDACTED_OLD_KEY"`). Our Firebase codebase lives at `www.vagtservices.com`. ✅
- **Deploy confirmed working**: `firebase deploy` from correct directory. `www.vagtservices.com` now serves our codebase. ✅
- **Login confirmed working**: `hello@vagtservices.com` / `Vagt@2026Admin` → lands on Admin Portal. ✅
- **Apex domain fix**: Added `vagtservices.com` (no www) to Firebase Hosting. DNS A record `199.36.158.100` + TXT `hosting-site=vagt---services` added at GoDaddy. Propagating (ETA 1–2 hrs from ~18:00 IST). ✅
- **HatsOff seed data**: 33 months of real guard rota (May 2023–Jan 2026) seeded into Firestore:
  - 22 unique guards with real names, clock numbers, designations
  - 9,242 attendance log records (P/L/W/O with realistic IST check-in/out times)
  - 303 monthly payslip records (days worked × daily rate, OT at 1.5×, PF at 12%)
  - 1 company + 1 site: HatsOff Aviation
  - Employees list shows 34 total (22 HatsOff + 12 existing from demo seed)
- **Seed script committed**: `firebase/functions/seed-hatsoff-data.js` ✅

### Login experience — confirmed SINGLE entry point

Only ONE file has a login form: `pages/portal.html`. The different experience seen between `www.vagtservices.com` and `vagt---services.web.app` was browser session cookies (different domains, different sessions) — not different code. Architecture is already unified.

### Dashboard stats showing dashes

Admin portal Overview shows dashes for Active employees, Checked in today, Open tickets, Pending leaves. Data IS in Firestore (Employees page correctly shows 33 active). The dashboard API call for stats may have a query mismatch with the `historical: true` flag on seeded employees. Investigate `/api/admin/stats` or equivalent in `admin.js` next session.

### Figma IA request

Nikhil wants a simple Figma information architecture diagram showing:
- The single unified flow (index → portal.html → role redirect → portal)
- What the platform prioritises (beat patrol, incidents, audit) vs deprioritises (guest/society)
- Use Figma MCP (already connected) next session to build this

---

## Session 4 — 2026-03-19

### What was built / fixed

**Deployed this session:**
- `firebase deploy --only hosting,functions,firestore:indexes` completed ✅
- 3 old stale Firestore indexes deleted (replaced by new ones with correct field names)
- DNS CNAME for vagtservices.com pointed at `vagt---services.web.app` (TTL 30 min)

**Bug fixes:**
- `employee-leaves.html` — content was rendering under the left nav blue sidebar. Root cause: `<main class="main-content">` should have been `<main class="main">`. One-character fix. ✅
- `admin-patrol.html` — Beat Patrol page showed "no endpoint found" for all API calls. Root cause: `const API = '/api/admin'` but the patrol router is mounted at `/api/patrol`. Fixed by changing API base and all four path strings (`/patrol/logs` → `/admin/logs`, etc.). ✅

**Unified login (new feature):**
- `pages/portal.html` — rebranded from "VAGT Staff Portal" to "VAGT Portal". "New guard?" → "New here? Create your account →". "User not found" Firebase error now shows an inline link to register.html. ✅
- `pages/register.html` — complete redesign. Now has a role selector at the top: **Security Guard** vs **Client**. Guard flow unchanged. Client flow adds: society/company name (required) + flat/unit number (optional). Routes to separate API endpoints based on role selection. ✅
- `firebase/functions/src/routes/auth.js` — added three new endpoints: `POST /api/auth/client/register`, `POST /api/auth/client/verify-otp`, `POST /api/auth/client/resend-otp`. Same OTP flow as employee registration. Stores `role: 'client'`, `society_name`, `unit_number` in `pending_registrations`. ✅
- `firebase/functions/src/routes/admin.js` — approval route now branches by `reg.role`. If `'client'`, creates a doc in `clients` collection with society_name/unit_number and grants `role: 'client'` claim. If `'employee'`, same as before. ✅
- `pages/admin-registrations.html` — registration cards now show a **Guard** or **Client** role badge. Client cards show society name + unit number in the metadata row. Success toast handles both employee IDs and client approval messages. ✅
- `index.html` — "Staff Login" button renamed to "Login". ✅

**Login auto-detection flow (summary):**
1. Go to vagtservices.com → click Login → `portal.html`
2. Enter email + password. Firebase Auth returns role claim on success.
3. `redirectByRole()` sends: admin → admin-portal, employee → employee-portal, client → client-portal.
4. Wrong email? Error shows "No account found. Create an account →" — links to register.html.
5. New user clicks "New here?" → register.html → picks Guard or Client → fills form → OTP → waits for admin approval.

**Deploy needed — CRITICAL:**
The live site is running an OLD pre-git codebase with `apiKey: "REDACTED_OLD_KEY"` in `assets/js/firebase-config.js` — a placeholder that was never filled in. This is why every login fails with 400. Our git repo has the correct API key and all correct files.

Run from your machine, **from inside the `VAGT New Website Design` folder**:
```bash
cd ~/"VAGT New Website Design"       # or wherever the folder lives
git pull origin claude/review-website-git-dPWyR   # get latest
firebase deploy --only hosting,functions --project vagt---services
```

After deploy, use: `hello@vagtservices.com` / `Vagt@2026Admin` (confirmed working — tested live against Firebase Auth directly)

---

## 💡 Ideas from TaxHacker — 2026-03-18

Reviewed the open-source [TaxHacker](https://github.com/vas3k/TaxHacker) project (self-hosted AI accounting app). Completely different product, but a few patterns are directly applicable to VAGT without changing the stack or derailing current work. Listed in order of effort vs. impact:

### ✅ Do now (small, high value)

**1. Audit money storage for float bugs**
TaxHacker stores all amounts as integers (paise, not rupees). Check `payslips`, `invoices`, and payroll calculations in `admin.js` and `employee.js` — if any amount is stored or computed as a JS float (`12500.5`, `amount * rate`), it will silently accumulate errors. Fix: multiply by 100 before storing, divide on display, or use `Math.round()` consistently. One afternoon to audit.

**2. Payslip generation needs a loading state**
Right now, clicking "Generate Payslip" gives no feedback while the PDF builds. TaxHacker tracks async jobs with a simple `progress` document in the DB. VAGT equivalent: write a `{ status: "generating", startedAt }` field to the payslip Firestore doc when the job starts, update to `{ status: "done" }` on completion. Frontend polls it. Guards stop thinking the button is broken.

### ⏳ Do next sprint (medium, high impact)

**3. CSV export on every admin list view**
Admin currently has no way to export anything — attendance, payroll, guest logs, patrol coverage, incidents. Enterprise clients will ask for this within weeks of going live. TaxHacker treats export as core, not an afterthought. For VAGT: add a single "Export CSV" button to each admin list page that calls the existing API with `?format=csv`. Backend change is ~10 lines per route.

### 🗓️ Park for later (bigger, don't touch yet)

**4. AI on incident reports** — Guards write unstructured incident text. AI could extract `incident_type`, `severity`, `persons_involved` into structured fields automatically. Real value, but needs an LLM API key and careful UX design for low-literacy users. Don't start until current backlog is clear.

**5. Per-client configurable report fields** — Different clients want different things in patrol/guest reports. TaxHacker solves this with user-defined fields + per-field AI prompts. Worth revisiting once you have 5+ clients with different needs.

---

### ⏳ PENDING TODO (Session 6 complete — Mark for Session 7)

**COMPLETED THIS SESSION:**
- ✅ Logo centered and enlarged on auth pages
- ✅ Employee progressive profiling page + endpoint
- ✅ Client progressive profiling page + endpoint
- ✅ Incident management audit written

**STILL PENDING FROM EARLIER SESSIONS:**
- [ ] **Deploy to Firebase** — `firebase deploy --only hosting,functions --project vagt---services` (includes logo change, profile pages, incident audit)
- [ ] **Build admin incident management page** — view/filter/action incidents (Priority 1 from audit)
- [ ] **Build client incident visibility page** — clients see incidents at their sites (Priority 1 from audit)
- [ ] **Scan the VAGT Google Drive folder** for new documents. Link: https://drive.google.com/drive/folders/1_P257aST6krZOaojlrOSoicQW8mHsSQf
- [ ] **Seed test data** — `node seed-hatsoff-data.js` from `firebase/functions/` (if not already done)
- [ ] **Wire SMS via MSG91** — provide API key + DLT sender ID for OTP + notifications
- [ ] **Wire photo attachments for incidents** — Cloud Storage upload + signed URLs (Priority 3 from audit)
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
