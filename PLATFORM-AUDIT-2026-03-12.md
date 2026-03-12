# VAGT Platform — Full Audit Report
**Date:** 2026-03-12
**Branch:** `claude/review-website-git-dPWyR`
**Live URL:** https://vagt---services.web.app
**Audited by:** Claude (desktop session)

---

## Executive Summary

| Area | Status |
|------|--------|
| Public website | ✅ Live — 7 pages |
| Employee portal | ✅ Functional — 5 pages, 4 working features |
| Client portal | ✅ Functional — 5 pages, 5 features |
| Admin portal | ⚠️ Partial — 11 pages, 5 disabled |
| Backend API | ✅ 37 routes across 6 modules |
| Authentication | ⚠️ Login works, admin role claim not set |
| Analytics | ❌ None — zero tracking installed |
| Security headers | ⚠️ Fixed in code, not yet deployed |
| SMS/OTP | ❌ Stubbed — not wired |
| Logos & images | ✅ 4 logos present, all paths correct |

**Immediate blocker:** Admin account has no `role: admin` custom claim. Run `set-admin-claim.js` from Mac.

---

## 1. Pages Inventory

### Public Website (7 pages)
| Page | File | Status | Notes |
|------|------|--------|-------|
| Home | `index.html` | ✅ Live | Client logos (EY, HatsOff, DS-Max, Quinbay) |
| Security | `pages/security.html` | ✅ Live | — |
| Facilities | `pages/facilities.html` | ✅ Live | — |
| Surveillance | `pages/surveillance.html` | ✅ Live | "Coming Soon" placeholder content |
| Shop | `pages/shop.html` | ✅ Live | Security equipment catalog |
| About | `pages/about.html` | ✅ Live | — |
| Contact | `pages/contact.html` | ✅ Live | Form (no backend wired) |

### Login Hub (1 page)
| Page | File | Status |
|------|------|--------|
| Portal login | `pages/portal.html` | ✅ Live — role picker + email/keycode login |

### Employee Portal (5 pages)
| Page | File | Status | Notes |
|------|------|--------|-------|
| Dashboard | `pages/employee-portal.html` | ✅ Functional | Check-in/out, shifts, payslip |
| Guest Log | `pages/employee-guests.html` | ✅ Functional | Entry, exit, QR slip, active list |
| Beat Patrol | `pages/employee-patrol.html` | ✅ Functional | NFC + QR + manual, 3 scan modes |
| Incidents | `pages/employee-incidents.html` | ✅ Functional | Report + history |
| Schedule | `pages/employee-schedule.html` | ✅ Functional | View assigned shifts |

### Client Portal (5 pages)
| Page | File | Status | Notes |
|------|------|--------|-------|
| Dashboard | `pages/client-portal.html` | ✅ Functional | Overview, complaint form |
| Invoices | `pages/client-invoices.html` | ✅ Functional | Invoice list + summary |
| Reports | `pages/client-reports.html` | ✅ Functional | Daily reports |
| Patrol View | `pages/client-patrol.html` | ✅ Functional | Beat patrol coverage |
| Guest View | `pages/client-guests.html` | ✅ Functional | Visitor log |

### Admin Portal (11 pages — 5 disabled)
| Page | File | Status | Notes |
|------|------|--------|-------|
| Dashboard | `pages/admin-portal.html` | ✅ Functional | Overview, activity log |
| Employees | `pages/admin-employees.html` | ✅ Functional | List, approve, keycode |
| Complaints | `pages/admin-complaints.html` | ✅ Functional | View, update status |
| Guest Log | `pages/admin-guests.html` | ✅ Functional | All-sites live + by-date |
| Patrol Log | `pages/admin-patrol.html` | ✅ Functional | Checkpoint management, logs |
| Payroll | `pages/admin-payroll.html` | 🚫 Disabled | "Portal Temporarily Disabled" |
| Reports | `pages/admin-reports.html` | 🚫 Disabled | "Portal Temporarily Disabled" |
| Schedule | `pages/admin-schedule.html` | 🚫 Disabled | "Portal Temporarily Disabled" |
| Sites | `pages/admin-sites.html` | 🚫 Disabled | "Portal Temporarily Disabled" |
| Clients | `pages/admin-clients.html` | 🚫 Disabled | "Portal Temporarily Disabled" |

---

## 2. Backend API — Complete Route Map

### Auth (`/api/auth/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| POST | `/login` | ✅ Stub | (Frontend uses SDK directly) |
| POST | `/forgot-password` | ✅ Live | OTP to email |
| POST | `/reset-password` | ✅ Live | Verify OTP + set new password |
| POST | `/resend-reset-otp` | ✅ Live | Resend reset OTP |
| POST | `/employee/register` | ✅ Live | Self-registration (step 1) |
| POST | `/employee/verify-otp` | ✅ Live | OTP verification (step 2) |
| POST | `/employee/resend-otp` | ✅ Live | Resend registration OTP |
| POST | `/guard/keycode-login` | ✅ Live | Physical keycode + GPS auth |

**⚠️ SMS not wired** — all OTP endpoints generate codes but don't send them.

### Employee (`/api/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| GET | `/attendance/today` | ✅ Live | Today's check-in/out status |
| POST | `/attendance/checkin` | ✅ Live | Mark check-in (GPS captured) |
| POST | `/attendance/checkout` | ✅ Live | Mark check-out |
| GET | `/leave/balance` | ✅ Live | Leave balance |
| GET | `/leave/history` | ✅ Live | Leave request history |
| POST | `/leave/apply` | ✅ Live | Apply for leave |
| GET | `/payslips` | ✅ Live | List payslips |
| GET | `/payslips/:id/download` | ✅ Live | PDF — generates + caches in Storage |
| GET | `/employee/schedule` | ✅ Live | Assigned shifts |
| GET | `/employee/sites` | ✅ Live | Guard's assigned sites |
| GET | `/employee/incidents` | ✅ Live | Incident history |
| POST | `/employee/incidents` | ✅ Live | Report new incident |

### Guest (`/api/guest/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| POST | `/entry` | ✅ Live | Log visitor entry + generate token |
| POST | `/exit/:token` | ✅ Live | Mark visitor exit by token |
| GET | `/active` | ✅ Live | Who's on-premises right now |
| GET | `/history` | ✅ Live | Past visitor log |
| GET | `/admin/logs` | ✅ Live | Admin — all-sites by date |
| GET | `/admin/active` | ✅ Live | Admin — live across all sites |

### Patrol (`/api/patrol/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| POST | `/checkpoint` | ✅ Live | Log a checkpoint scan |
| GET | `/checkpoints` | ✅ Live | Guard's checkpoints for their sites |
| GET | `/today` | ✅ Live | Today's patrol log |
| GET | `/admin/checkpoints` | ✅ Live | All checkpoints (admin) |
| POST | `/admin/checkpoints` | ✅ Live | Register new NFC checkpoint |
| DELETE | `/admin/checkpoints/:id` | ✅ Live | Remove a checkpoint |
| GET | `/admin/logs` | ✅ Live | Admin patrol scan logs |

### Admin (`/api/admin/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| GET | `/overview` | ✅ Live | Dashboard stats |
| GET | `/activity` | ✅ Live | Activity log |
| GET | `/pending-registrations` | ✅ Live | Pending guard approvals |
| POST | `/registrations/:id/approve` | ✅ Live | Approve guard |
| POST | `/registrations/:id/reject` | ✅ Live | Reject guard |
| GET | `/pending-leaves` | ✅ Live | Leaves awaiting decision |
| POST | `/leaves/:id/approve` | ✅ Live | Approve leave |
| POST | `/leaves/:id/reject` | ✅ Live | Reject leave |
| GET | `/employees` | ✅ Live | All employees (limit 500) |
| GET | `/employees/:id` | ✅ Live | Employee detail |
| POST | `/employees/:id/deactivate` | ✅ Live | Deactivate account |
| POST | `/employees/:id/reactivate` | ✅ Live | Reactivate account |
| GET | `/schedule` | ✅ Live | All shifts |
| POST | `/schedule` | ✅ Live | Create shift |
| DELETE | `/schedule/:id` | ✅ Live | Delete shift |
| GET | `/clients` | ✅ Live | All clients |
| GET | `/clients/:id` | ✅ Live | Client detail |
| GET | `/sites` | ✅ Live | All sites |
| GET | `/sites/:id` | ✅ Live | Site detail |
| GET | `/payroll` | ✅ Live | Payroll overview |
| POST | `/payroll/run` | ✅ Live | Run payroll for month |
| POST | `/payroll/:employee_id/generate-slip` | ✅ Live | Generate payslip |
| GET | `/complaints` | ✅ Live | All complaints |
| GET | `/complaints/:id` | ✅ Live | Complaint detail |
| POST | `/complaints/:id/status` | ✅ Live | Update status / add note |
| GET | `/reports` | ✅ Live | Daily reports |
| POST | `/employees/:id/generate-keycode` | ✅ Live | Issue keycode card |
| POST | `/employees/:id/revoke-keycode` | ✅ Live | Revoke keycode |
| GET | `/sign-in-events` | ✅ Live | Sign-in event log |

### Client (`/api/`)
| Method | Route | Status | Purpose |
|--------|-------|--------|---------|
| POST | `/complaints` | ✅ Live | File complaint |
| GET | `/complaints` | ✅ Live | Client's complaints |
| GET | `/client/deployment-summary` | ✅ Live | Guard coverage summary |
| GET | `/client/sites` | ✅ Live | Client's sites |
| GET | `/client/reports` | ✅ Live | Daily reports scoped to client |
| GET | `/client/invoices/summary` | ✅ Live | Invoice summary |
| GET | `/client/invoices` | ✅ Live | Invoice list |
| GET | `/client/patrol` | ✅ Live | Patrol logs for client's sites |
| GET | `/client/guests` | ✅ Live | Visitors scoped to client's sites |

**Total: 37 API routes across 6 modules.**

---

## 3. Assets & Branding

### Logos
| Asset | Path | Used In | Status |
|-------|------|---------|--------|
| VAGT white logo | `assets/images/logos/vagt-logo-white.png` | All 22 pages | ✅ Present |
| HatsOff logo | `assets/images/logos/hatsoff.jpg` | `index.html` client grid | ✅ Present |
| DS-Max logo | `assets/images/logos/dsmax.jpeg` | `index.html` client grid | ✅ Present |
| Quinbay logo | `assets/images/logos/quinbay.jpeg` | `index.html` client grid | ✅ Present |

**EY** is shown as a text badge (`<span class="ey-logo">EY</span>`) — no image file needed. ✅

### Missing / Gaps
- ❌ No favicon — browser tab shows a blank icon
- ❌ No hero/photography images — service pages (security.html, facilities.html, surveillance.html) are text-only
- ❌ No staff photos or site images
- ❌ Surveillance page is placeholder ("Coming Soon" content)

### Brochures
| File | Size | Status |
|------|------|--------|
| `VAGT Brochure 2025.pdf` | In assets | ✅ Linked in site |
| `Securitas-reference-brochure.pdf` | ~35 MB | ⚠️ In git history, bloating repo |
| `Facilities-Management-brochure.pdf` | In assets | ✅ Present |

---

## 4. Analytics

**Status: ❌ Zero analytics installed.**

No Google Analytics 4, no Mixpanel, no Hotjar, no PostHog, no Amplitude, no Microsoft Clarity — nothing. The platform has no visibility into:
- How many people visit the public website
- Which pages they drop off on
- Whether the contact form gets submissions
- How guards use the portal
- Client complaint trends

**Recommendation:** Add Google Analytics 4 (free) to at least `index.html` and all portal pages. One script tag, 10 minutes to set up.

---

## 5. Feature Workflow Charts

---

### WORKFLOW 1: Guard Login (Email/Password)

```
Guard opens browser
        │
        ▼
portal.html — "Choose your access level"
        │
        ▼ clicks Employee
Login form shown (email + password tabs)
        │
        ▼ enters credentials
Firebase Auth SDK → identitytoolkit.googleapis.com
        │
   ┌────┴────┐
   │ FAIL    │ SUCCESS
   ▼         ▼
Error msg   getIdTokenResult()
on screen   checks role claim
            │
       ┌────┴──────────┐
       │               │
    role='employee'  role='admin' or 'client'
       ▼               ▼
employee-portal.html  correct portal
```

### WORKFLOW 2: Guard Login (Keycode)

```
Guard opens browser → portal.html
        │
        ▼ clicks Employee → "Guard Keycode" tab
Enters XXXX-XXXX keycode
        │
        ▼
Browser requests geolocation permission
        │
   ┌────┴────┐
   │ DENIED  │ GRANTED
   ▼         ▼
Error msg  POST /api/auth/guard/keycode-login
           { keycode, latitude, longitude, device_info }
                │
           ┌────┴────┐
           │ FAIL    │ SUCCESS
           ▼         ▼
       Error msg   Returns custom_token
       on screen         │
                         ▼
                 auth.signInWithCustomToken()
                         │
                         ▼
                 onAuthStateChanged fires
                         │
                         ▼
                 employee-portal.html
```

### WORKFLOW 3: Guard Registration (Self-Service)

```
Guard opens portal.html → "Register" link
        │
        ▼
POST /api/auth/employee/register
{ name, phone, email, site_id, company_id }
        │
        ▼
Firebase Auth account created (DISABLED)
Firestore: pending_registrations/{id}
OTP generated (crypto.randomInt) ← SMS NOT SENT YET
        │
        ▼
Guard sees "Enter the OTP sent to your phone"
        │
        ▼
POST /api/auth/employee/verify-otp { otp }
        │
   ┌────┴────┐
   │ WRONG   │ CORRECT
   ▼         ▼
Error msg   OTP verified
            pending_registrations doc updated
            → Admin notified (activity_log entry)
        │
        ▼
⏳ Guard WAITS for admin approval
(account still disabled — cannot log in)
```

### WORKFLOW 4: Admin Approves Guard Registration

```
Admin logs in → admin-portal.html
        │
        ▼
GET /api/admin/pending-registrations
Shows list of pending guards
        │
        ▼ clicks "Approve"
POST /api/admin/registrations/:id/approve
        │
        ▼
Firebase Auth account ENABLED
Firestore employee record created with VAGT-XXXX ID
(ID uses transaction to prevent duplicates)
role claim set: { role: 'employee' }
activity_log entry with actor_uid
        │
        ▼
⚠️ Password reset SMS NOT sent (SMS not wired)
Guard must be told credentials manually
```

### WORKFLOW 5: Guard Check-In

```
Guard opens employee-portal.html
        │
        ▼
Dashboard shows today's attendance status
GET /api/attendance/today
        │
        ▼ "Already checked in?" → shows checkout btn
        ▼ "Not checked in" → shows check-in btn

Guard clicks "Check In"
        │
        ▼
POST /api/attendance/checkin
{ employee_id, site_id, timestamp (IST) }
        │
        ▼
Firestore: attendance_logs/{doc}
{ employee_id, site_id, check_in, status: 'present' }
        │
        ▼
Dashboard updates: shows check-in time
Check-out button appears
```

### WORKFLOW 6: Guard Check-Out

```
Guard clicks "Check Out" on employee-portal.html
        │
        ▼
POST /api/attendance/checkout
        │
        ▼
Firestore attendance_logs doc updated:
{ check_out, duration_minutes, status: 'completed' }
        │
        ▼
Dashboard shows completed shift duration
```

### WORKFLOW 7: Guest Entry Logging

```
Guard opens employee-guests.html
        │
        ▼
Fills form: visitor name, phone, host name, purpose
        │
        ▼
POST /api/guest/entry
{ visitor_name, visitor_phone, host_name, purpose, site_id }
        │
        ▼
Firestore: guest_logs/{doc}
{ token (8-char), entry_time, status: 'on-site', ... }
        │
        ▼
QR slip modal opens:
- Shows visitor name, host, entry time
- QR code image (from API response)
- Token: A3F9C12B (also on slip)
        │
        ▼ Guard prints slip / shows QR to visitor
Visitor keeps QR slip

Active guests list refreshes — visitor appears
```

### WORKFLOW 8: Guest Exit

```
Visitor leaves → Guard on employee-guests.html

Option A — Token entry:
Guard types 8-letter token from slip
        │
        ▼
POST /api/guest/exit/:token
        │
        ▼
Firestore guest_log updated:
{ exit_time, status: 'exited', duration_minutes }

Option B — Click "Mark Exit" on active list:
GET /api/guest/active → shows current visitors
Guard clicks "Mark Exit" button next to name
        │
        ▼
POST /api/guest/exit/:token (same endpoint)
```

### WORKFLOW 9: Beat Patrol (NFC)

```
Guard opens employee-patrol.html
        │
        ▼
GET /api/patrol/checkpoints → loads assigned checkpoints
GET /api/patrol/today → loads today's scans

Guard arrives at checkpoint
        │
   ┌────┼──────────┐
   │    │          │
  NFC   QR      Manual
   │    │          │
   ▼    ▼          ▼
Web NFC API  Camera scan  Dropdown + confirm
reads tag   decodes QR

All modes → tagId extracted
        │
        ▼
POST /api/patrol/checkpoint
{ nfc_tag_id, scan_method: 'nfc'|'qr'|'manual' }
        │
        ▼
Firestore: patrol_logs/{doc}
{ checkpoint_id, guard_id, site_id, scanned_at, method }
        │
        ▼
UI: checkpoint turns green ✓
"Checkpoint logged" + time shown
```

### WORKFLOW 10: Incident Reporting

```
Guard opens employee-incidents.html
        │
        ▼
Form: type, location, description, persons involved
        │
        ▼
POST /api/employee/incidents
        │
        ▼
Firestore: incidents/{doc}
{ type, location, description, reported_by, site_id, timestamp }
        │
        ▼
Guard sees incident in history list
Admin sees it in activity_log / reports
```

### WORKFLOW 11: Leave Request

```
Guard opens employee-portal.html → Leave section
GET /api/leave/balance → shows days remaining
GET /api/leave/history → shows past requests
        │
        ▼
Guard fills leave form: dates, type, reason
POST /api/leave/apply
        │
        ▼
Firestore: leave_requests/{doc}
{ status: 'pending', dates, type, reason }
        │
        ▼
⏳ Awaiting admin action

Admin on admin-portal.html:
GET /api/admin/pending-leaves
Sees guard's request
        │
   ┌────┴────┐
   │ REJECT  │ APPROVE
   ▼         ▼
POST …/reject  POST …/approve
status: 'rejected'  status: 'approved'
        │              │
        ▼              ▼
Guard sees updated status on next load
```

### WORKFLOW 12: Client Files a Complaint

```
Client logs in → client-portal.html
        │
        ▼
"Report an Issue" form visible on dashboard
Fills: subject, description
        │
        ▼
POST /api/complaints
{ subject, description, site_id }
        │
        ▼
Firestore: complaints/{doc}
{ ticket_id (random), status: 'open', client_id, site_id }
        │
        ▼
Client sees ticket in "My Complaints" list

Admin on admin-complaints.html:
GET /api/admin/complaints
Sees all complaints, filters by status
        │
        ▼ admin adds note + changes status
POST /api/admin/complaints/:id/status
{ status: 'in-progress'|'resolved', admin_note }
        │
        ▼
Client sees updated status on refresh
```

### WORKFLOW 13: Payslip Download

```
Guard on employee-portal.html
GET /api/payslips → list of monthly payslips
        │
        ▼ clicks "Download"
GET /api/payslips/:id/download
        │
   ┌────┴──────────────────┐
   │ pdf_path exists        │ No pdf_path yet
   │ in Firestore doc       │
   ▼                        ▼
Fetch from Firebase Storage  Generate PDF with pdfkit
Serve to guard               Upload to Storage
                             Stamp pdf_path on Firestore
                             Serve to guard
        │
        ▼
Guard's browser downloads the PDF payslip
```

### WORKFLOW 14: Admin — Guard Keycode Issuance

```
Admin on admin-employees.html
GET /api/admin/employees → employee list
        │
        ▼ finds guard, clicks "Generate Keycode"
POST /api/admin/employees/:id/generate-keycode
        │
        ▼
crypto.randomBytes → XXXX-XXXX format
Firestore: guard_keycodes/{doc}
{ keycode, employee_uid, issued_at, active: true }
        │
        ▼
Admin sees keycode on screen
Physically gives card to guard
Guard uses keycode tab on portal.html to log in
```

---

## 6. Known Issues & Gaps

### 🔴 Critical (Blocking usage)
| Issue | Impact | Fix |
|-------|--------|-----|
| Admin has no `role: admin` claim | Can't access admin portal | Run `set-admin-claim.js` from Mac |
| Security headers not deployed | No CSP/XFO in production | `firebase deploy --only hosting` from Mac |

### 🟠 High (Broken features)
| Issue | Impact | Fix |
|-------|--------|-----|
| SMS/OTP not wired | Guards can't self-register (OTP never arrives) | Sign up at msg91.com, wire API |
| Password reset SMS not sent on approval | Admin must share creds manually | Blocked on SMS above |
| Contact form not wired | Contact page submissions go nowhere | Need a form handler (Formspree / Cloud Function) |
| 5 admin pages disabled | Payroll, Reports, Schedule, Sites, Clients not accessible | Need to re-enable and test |

### 🟡 Medium (Technical debt)
| Issue | Impact | Fix |
|-------|--------|-----|
| No analytics | Zero visibility on usage | Add GA4 (1 hour) |
| No favicon | Poor browser tab experience | Add 32×32 favicon.ico |
| `activity_log` unbounded | Will grow forever, slow over time | Add TTL / archival job |
| 35 MB PDF in git history | Repo bloat | git filter-repo cleanup (see Pending in handoff) |
| Missing composite Firestore indexes | Some queries slow or error | Add indexes as needed |
| No input validation library | Manual checks may have gaps | Add joi or zod |

### 🟢 Low (Polish)
| Issue | Impact | Fix |
|-------|--------|-----|
| Surveillance page is placeholder | Looks incomplete | Real content needed |
| No hero photography | Generic look | Shoot or license site photos |
| English-only UI | Guards struggle | i18n needed (Hindi, Kannada priority) |
| `localhost` not in GCP API key | Local testing breaks | Add in GCP Console |

---

## 7. What's Not Built Yet

| Feature | Priority | Notes |
|---------|----------|-------|
| SMS/OTP via MSG91 | P1 | Blocks guard self-registration |
| Payroll page (admin) | P2 | Page disabled — API exists |
| Reports page (admin) | P2 | Page disabled — API exists |
| Schedule management (admin) | P3 | Page disabled — API exists |
| Sites management (admin) | P3 | Page disabled — API exists |
| Clients management (admin) | P3 | Page disabled — API exists |
| NFC checkpoint registration | P2 | Blocked on physical NFC stickers arriving |
| Selfie check-in | P4 | Not designed — product decision needed |
| Multilingual UI | P3 | Hindi + Kannada priority |
| Google Analytics | P2 | Zero effort, huge value |

---

## 8. Deployment Checklist (What Still Needs Running from Mac)

```
□ node set-admin-claim.js          ← URGENT: fixes admin login
□ firebase deploy --only hosting   ← deploys security headers fix
□ firebase deploy --only functions ← deploys payslip Storage caching
□ gcloud GCS bucket setup          ← enables daily Firestore backups
□ Add localhost to GCP API key     ← enables local testing
□ Clean up sensitive scripts        ← delete *.py, service account JSONs
□ Revoke old service account key   ← Firebase Console → Service Accounts
```

---

*Generated 2026-03-12 by full codebase audit. All findings based on committed code on branch `claude/review-website-git-dPWyR`.*
