# Incident Management Audit — VAGT Platform
**Date:** 2026-03-20
**Scope:** Full accountability chain from guard filing to admin resolution

---

## 1. WHAT'S CURRENTLY BUILT

### Guard-facing endpoints (employee.js)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/employee/incidents` | GET | List guard's filed reports (last 50, newest first) | ✅ Built |
| `/api/employee/incidents` | POST | Guard files new incident report | ✅ Built |

### Guard-facing UI (pages/employee-incidents.html)

| Feature | Status | Notes |
|---------|--------|-------|
| Incident type selector (10 types) | ✅ Built | Trespassing, Theft, Vandalism, Medical emergency, Fire, Suspicious person, Fight, Equipment broken, Other |
| Severity selector (4 levels) | ✅ Built | Low, Medium, High, Critical — visual radio buttons |
| Date/time picker | ✅ Built | Date required, time optional |
| Location/site input | ✅ Built | Pre-filled from guard profile, editable |
| Description textarea | ✅ Built | "What happened?" free text |
| People involved field | ✅ Built | Optional text field |
| Action taken dropdown (6 options) | ✅ Built | Reported to supervisor, Called police, Called ambulance, Moved people, Stopped myself, Need help |
| Submit button | ✅ Built | Creates incident, shows reference number on success |
| Incident history list | ✅ Built | Shows past incidents with type, date, severity pill |

### Admin-facing endpoints (admin.js)

| Endpoint | Method | Purpose | Status | Detail |
|----------|--------|---------|--------|--------|
| Analytics endpoint | GET | `/api/admin/reports` includes incident breakdown | ✅ Built | Returns incidents_by_type array + incident count per employee |

### Admin-facing UI (admin pages)

| Page | Feature | Status | Notes |
|------|---------|--------|-------|
| None found | No dedicated admin incident management page | ❌ Missing | No page to view, filter, or action incidents |

### Background automation (activity_log)

| Trigger | Action | Status |
|---------|--------|--------|
| Guard files incident | Logged to `activity_log` collection | ✅ Built |
| High/Critical incident | Logged with ⚠️ prefix (urgent visual cue) | ✅ Built |
| SMS notification to admin | NOT IMPLEMENTED | 🔲 Stubbed (MSG91 integration pending) |

---

## 2. GAPS: MISSING FOR COMPLETE ACCOUNTABILITY CHAIN

### Photo/Video attachment on incident report
- **Status:** ❌ NOT BUILT
- **Why needed:** Photographic evidence is critical in security disputes. Clients will ask for this in the first month.
- **Impact:** Guards can only describe what happened — no visual proof for client disputes or legal proceedings.
- **Effort to add:** Medium (requires file upload to Cloud Storage, URL storage in incident doc, signed URLs for client viewing)

### Supervisor/admin notification on new incident
- **Status:** ❌ NOT FULLY WIRED
- **Current:** High/Critical incidents logged to activity_log (visible on admin dashboard refresh only). No real-time notification.
- **Why needed:** Admin must know immediately when a critical incident occurs — especially off-hours.
- **Missing:**
  - SMS/push notification to duty manager (requires MSG91 API key + DLT sender ID)
  - Email notification to admin email
  - In-app notification badge on admin portal
- **Impact:** Duty manager might not know about critical incident for hours.
- **Effort:** Small for email (Firebase transactional emails); Medium for SMS (needs MSG91 integration)

### Client visibility of incidents at their site
- **Status:** ❌ PARTIAL
- **What exists:** `incidents` collection includes `client_uid` field (denormalized from site). Clients technically *can* query incidents at their sites via Firestore rules.
- **What's missing:**
  - No UI page in client portal to view/filter incidents
  - No client notification when incident is filed at their site
  - No incident status update push to clients
- **Why needed:** Clients need to know immediately when something happens at their property. SLA compliance, audit trail, transparency.
- **Effort:** Medium (build client-incidents.html page + add notification logic)

### Resolution workflow (open → in_progress → resolved with notes)
- **Status:** ❌ NOT BUILT
- **Current:** Incidents stored with status 'submitted'. No admin endpoint to change status.
- **Why needed:**
  - Admin needs to acknowledge receipt (mark 'acknowledged')
  - Admin needs to mark 'in_progress' when investigating
  - Admin needs to mark 'resolved' with resolution notes
  - Guard/client needs to see resolution outcome
- **Missing:**
  - Admin endpoint: `POST /api/admin/incidents/:id/status` to change status and add notes
  - Admin UI page to view incident queue and action them
  - Client notification when incident is resolved
- **Effort:** Medium (API endpoint + admin UI page)

### Auto-inclusion in monthly PDF report
- **Status:** ❌ NOT BUILT
- **Current:** Incidents are tracked separately. No payroll/report system includes them.
- **Why needed:**
  - Clients need a monthly report showing all incidents at their site
  - Auditors need incident summaries grouped by type/severity
  - Nikhil needs SLA compliance data (incidents resolved within X hours)
- **Missing:**
  - Monthly incident summary in PDF payslip/report generation
  - Grouping by severity + type
  - Average resolution time per incident
- **Effort:** Medium (integrate into reporting pipeline)

### SLA timer / escalation if unresolved after X hours
- **Status:** ❌ NOT BUILT
- **Current:** No SLA definition or tracking.
- **Why needed:**
  - Enterprise clients will demand "We solve critical incidents within 4 hours"
  - Duty manager needs to know which incidents are overdue
  - Escalation chain: If unresolved in 4 hrs → escalate to senior admin
- **Missing:**
  - SLA definition per severity level (hardcoded or client-configurable?)
  - Background job: Check all open incidents; if age > SLA, escalate
  - Admin dashboard widget showing overdue incidents
- **Effort:** High (requires scheduled Cloud Function + complexity in escalation logic)

---

## 3. FIRESTORE SCHEMA: INCIDENTS COLLECTION

**Collection:** `incidents`

| Field | Type | Purpose | Nullable | Notes |
|-------|------|---------|----------|-------|
| `employee_uid` | string (FK) | Who filed the report | ❌ No | Guard's Firebase UID |
| `employee_name` | string | Denormalized guard name | ✅ Yes | For admin dashboard (no FK lookup needed) |
| `type` | string | Incident category | ❌ No | One of: Trespassing, Theft, Attempted theft, Vandalism, Medical emergency, Fire or smoke, Suspicious person, Fight, Equipment broken, Other |
| `severity` | string | Risk level | ❌ No | One of: low, medium, high, critical (lowercase) |
| `site_id` | string (FK) | Which site | ✅ Yes | Can be null if incident happened off-site |
| `site_name` | string | Denormalized site name | ✅ Yes | For reports (no FK lookup) |
| `client_uid` | string (FK) | Which client owns the site | ✅ Yes | Denormalized from site — lets client-portal query without joins |
| `occurred_at` | timestamp | When incident happened | ❌ No | ISO timestamp; defaults to submission time if not provided |
| `description` | string | What happened (guard's account) | ❌ No | Free text, usually 50–500 chars |
| `persons_involved` | string | Names/descriptions of people involved | ✅ Yes | Optional; e.g., "2 unknown men, resident from 304" |
| `action_taken` | string | Guard's response | ✅ Yes | One of: Reported to supervisor, Called police, Called ambulance, etc. |
| `reference_number` | string | Unique identifier | ❌ No | Format: `INC-YYYY-####` (e.g., `INC-2026-3421`) |
| `status` | string | Incident state | ❌ No | One of: submitted, acknowledged, in_progress, resolved. **Currently always "submitted"** |
| `submitted_at` | timestamp | When guard filed | ❌ No | Server timestamp |

---

## 4. SUGGESTED SCHEMA ADDITIONS (For gaps above)

### Resolution workflow fields (add to incidents doc on status change)

| Field | Type | Purpose | When to set |
|-------|------|---------|-------------|
| `admin_uid` | string (FK) | Who is handling | On acknowledge/transition to in_progress |
| `admin_name` | string | Denormalized admin name | On acknowledge |
| `acknowledged_at` | timestamp | When admin read it | On acknowledge |
| `in_progress_at` | timestamp | When investigation started | On transition to in_progress |
| `resolved_at` | timestamp | When admin marked resolved | On transition to resolved |
| `resolution_notes` | string | Admin's summary of what happened + action taken | On resolve |
| `resolution_approved_by` | string (FK) | Senior admin who approved resolution | On resolve (optional — only if escalated) |

### Photo/video attachment fields

| Field | Type | Purpose |
|-------|------|---------|
| `attachments` | array of objects | Photos/videos; each object: `{ url: "", type: "photo\|video", uploaded_by: "uid", uploaded_at: timestamp }` |
| `attachment_count` | number | Quick count; denormalized for queries |

### SLA tracking fields

| Field | Type | Purpose |
|-------|------|---------|
| `sla_hours` | number | Service-level agreement response time (e.g., 4 for critical) |
| `sla_deadline` | timestamp | submitted_at + sla_hours; used for escalation queries |
| `is_overdue` | boolean | Denormalized flag for fast admin dashboard queries |
| `escalation_level` | number | 0 = none, 1 = first escalation to senior admin, 2 = escalate to director |

### Firestore composite index needed (for escalation job)

```
Collection: incidents
Filter: status = "open" OR status = "in_progress"
Sort: sla_deadline ASC
```

---

## 5. PRIORITY BUILD ORDER (Using 3-Why Test)

### Priority 1 — Admin incident management page + status workflow
**Who does it serve:** Admin + clients (both need visibility + proof)
**Works without Nikhil:** Yes (API endpoint + page, no external dependencies)
**Makes VAGT harder to replace:** YES — this is table-stakes for an enterprise security platform

1. Add `POST /api/admin/incidents/:id/status` endpoint (change status, add notes)
2. Build `pages/admin-incidents.html` page (list all incidents, filter by site/guard/status/severity, action buttons)
3. Add resolution_notes + acknowledged_at + resolved_at fields to incident schema
4. Integrate into admin PDF reporting

**Estimated effort:** 12–16 hours
**Expected value:** Closes critical gap; enterprise clients will bounce without this

---

### Priority 2 — Client incident visibility
**Who does it serve:** Clients (need to see what happens at their sites)
**Works without Nikhil:** Yes
**Makes VAGT harder to replace:** YES — clients expect this

1. Build `pages/client-incidents.html` (list incidents at client's sites, grouped by date/severity)
2. Add basic email notification to client when incident filed at their site
3. Firestore rules: Ensure clients can only see incidents at their own sites

**Estimated effort:** 8–10 hours
**Expected value:** High trust signal; clients feel informed

---

### Priority 3 — Photo/video attachments
**Who does it serve:** Guards + admins + clients (evidence trail)
**Works without Nikhil:** Partially (can use compat SDK file upload; needs Cloud Storage setup)
**Makes VAGT harder to replace:** YES — litigation, insurance, clients demand this

1. Add file upload to incident form (up to 3 photos, <5MB each)
2. Upload to Cloud Storage; store URL in incident doc
3. Client portal can view attachments
4. Firestore security rules: Only guard who filed can see their own; client can see all at their site

**Estimated effort:** 14–18 hours (file upload + Cloud Storage IAM + signed URLs)
**Expected value:** Critical for client trust + legal defensibility

---

### Priority 4 — Admin notification (SMS/Email)
**Who does it serve:** Admin/duty manager (need real-time alert)
**Works without Nikhil:** Email yes; SMS no (blocked on MSG91 integration)
**Makes VAGT harder to replace:** YES for high/critical incidents

1. Send email to admin@vagtservices.com when high/critical incident filed
2. Implement SMS via MSG91 (requires API key + DLT sender ID from Nikhil)
3. Add Firebase Cloud Messaging (FCM) token to admin accounts for in-app push

**Estimated effort:** 6–8 hours (email) + 4–6 hours (SMS integration)
**Expected value:** Closes response-time gap; critical for duty manager

---

### Priority 5 — SLA tracking + escalation
**Who does it serve:** Admin + Nikhil (SLA compliance tracking)
**Works without Nikhil:** Yes
**Makes VAGT harder to replace:** Medium (nice-to-have initially; essential for 5+ clients)

1. Define SLA tiers: Critical = 2 hrs, High = 4 hrs, Medium = 24 hrs, Low = 72 hrs
2. Add sla_deadline + is_overdue fields to incident doc
3. Scheduled Cloud Function: Every 30 min, check for overdue incidents; if found, escalate (send email to senior admin)
4. Admin dashboard widget: Show "3 overdue incidents"

**Estimated effort:** 18–24 hours (requires careful escalation logic + scheduled job testing)
**Expected value:** Medium for now (essential later when scaling to large enterprises)

---

## 6. IMMEDIATE ACTIONS (Next Session)

1. **Build admin incident page** (pages/admin-incidents.html)
   - View all incidents, filter by status/severity/site/guard
   - Action buttons: Acknowledge, Mark In Progress, Resolve (with notes modal)
   - Show reference number + guard name + site + description + severity
   - Real-time update Firestore on action

2. **Add admin incident API endpoint** (admin.js)
   - `POST /api/admin/incidents/:id/status` with body `{ status, resolution_notes }`
   - Update incident doc + log activity

3. **Wire client incident visibility** (client-incidents.html + client.js endpoint)
   - Guard the endpoint: Only show incidents at client's own sites
   - Add email notification when incident filed at client site

4. **Capture client feedback** on incident visibility + photo/video needs before building those features

---

## 7. KNOWN CONSTRAINTS

- **No external auth burden:** All endpoints already have role-based middleware ✅
- **Firestore rules already in place:** Role-based access control exists ✅
- **Activity log integration ready:** High/critical incidents already logged ✅
- **Photo upload:** Blocked on Cloud Storage IAM setup (Nikhil to do)
- **SMS notifications:** Blocked on MSG91 API key + DLT sender ID (Nikhil to do)
- **Email notifications:** Possible now via Firebase transactional emails (no external key needed)

---

## Audit Summary

| Category | Status | Risk |
|----------|--------|------|
| Guard can file incident | ✅ Complete | Low |
| Admin can see incidents (in reports) | ✅ Partial | High |
| Admin can action incidents | ❌ Missing | **Critical** |
| Client can see incidents | ❌ Missing | **Critical** |
| Real-time notification | ❌ Missing | High |
| Photo/video evidence | ❌ Missing | High |
| SLA tracking | ❌ Missing | Medium |
| Escalation chain | ❌ Missing | Medium |

**Recommendation:** Build Priority 1 (admin incident page) immediately. It's the minimum viable feature to make the platform enterprise-ready.
