# VAGT — GitHub Issues Backlog

Copy-paste each block below into GitHub Issues (nikhiljha3105/vagt-website-2026).
After creating, delete this file and track everything in GitHub.

---

## Issue 1 — Wire SMS/OTP delivery via MSG91

**Labels:** `backend` `blocked`

**Body:**
All OTP endpoints are implemented but stubbed — no SMS is sent.

**Files:** `firebase/functions/src/routes/auth.js` — search `// TODO: Send OTP`

**Steps to unblock:**
1. Nikhil signs up at msg91.com
2. Gets API key + DLT registered sender ID
3. Wire into auth.js stubs

**Acceptance:** Guard registers → receives OTP on phone → can complete registration.

---

## Issue 2 — Send password reset link on admin approval

**Labels:** `backend` `blocked`

**Body:**
After an admin approves a guard registration, the system should SMS a password-reset link.
The code exists but is commented out.

**File:** `firebase/functions/src/routes/admin.js` line 167
**Blocked on:** Issue #1 (SMS/OTP delivery must be wired first)

**Acceptance:** Admin approves guard → guard receives SMS with login link.

---

## Issue 3 — Register NFC checkpoints once stickers arrive

**Labels:** `ops` `blocked`

**Body:**
Beat patrol is fully built. Physical NFC 213 stickers need to arrive, then each checkpoint must be registered.

**API:** `POST /api/patrol/admin/checkpoints`
```json
{ "label": "Main Gate", "nfc_tag_id": "<scanned-id>", "site_id": "...", "site_name": "..." }
```

**Steps:**
1. Order NFC 213 stickers (Amazon/Flipkart)
2. On arrival: admin opens patrol page, scans each tag, registers via API
3. Guards can then start scanning

---

## Issue 4 — Admin UI: Patrol log viewer

**Labels:** `frontend` `admin-portal`

**Body:**
The API to view patrol logs already exists but there is no UI page for it.

**API:** `GET /api/patrol/admin/logs?site_id=&date=&guard_id=`

Build `pages/admin-patrol-logs.html`:
- Filter by site, date, guard
- Show timeline of checkpoints scanned
- Highlight missed checkpoints
- Add to admin sidebar nav

---

## Issue 5 — HTTP security headers in production

**Labels:** `security` `infra`

**Body:**
The `_headers` file in the project root is silently ignored — Firebase Hosting uses `firebase.json` format, not Netlify/Vercel `_headers`.

As a result, no security headers (`X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, etc.) are being served in production.

**Fix:** Migrate all rules from `_headers` into the `"headers"` key in `firebase.json`.

**Reference:** https://firebase.google.com/docs/hosting/full-config#headers

---

## Issue 6 — Selfie check-in

**Labels:** `feature` `employee-portal` `needs-design`

**Body:**
Guards should capture a selfie at check-in time to verify physical presence.

Needs product design decision before building:
- Where is the photo stored? (Firebase Storage)
- Who reviews it — ops manager, client, or automated?
- What happens if a guard has no camera?

**No code should be written until product questions are answered.**

---

## Issue 7 — Multilingual UI (Hindi, Kannada, Tamil, Odia)

**Labels:** `feature` `ux` `i18n`

**Body:**
Many guards are not English-primary. The UI must support Hindi, Kannada, Tamil, and Odia.

**Approach:**
1. Extract all UI strings to `assets/js/i18n.js` (one object per language)
2. Add language selector to nav bar (EN / हिं / ಕನ್ನ / தமி / ଓଡ଼)
3. Load correct language on page render

**Priority:** High — affects every guard who uses the platform daily.
