Perfect! I now have all the information I need to create a comprehensive workflow reference. Let me compile this into a detailed report.

---

# VAGT SECURITY SERVICES — COMPREHENSIVE WORKFLOW REFERENCE

**Date:** March 13, 2026  
**Platform:** Full-stack Firebase (Cloud Functions, Firestore, Firebase Auth, Hosting)  
**Document Scope:** All user-facing workflows across 4 portals (Public, Employee, Client, Admin)

---

## TABLE OF CONTENTS
1. [Overview & Portal Structure](#overview)
2. [PUBLIC WEBSITE WORKFLOWS](#public)
3. [AUTHENTICATION WORKFLOWS](#auth)
4. [EMPLOYEE PORTAL WORKFLOWS](#employee)
5. [CLIENT PORTAL WORKFLOWS](#client)
6. [ADMIN PORTAL WORKFLOWS](#admin)

---

## OVERVIEW & PORTAL STRUCTURE {#overview}

### Active Portals

| Portal | Users | Pages | Status |
|--------|-------|-------|--------|
| **Public Website** | Marketing, lead gen | 7 pages | Working |
| **Employee Portal** | Guards, supervisors | 5 pages | Working, 4 features |
| **Client Portal** | Facility managers, HR | 5 pages | Working, 5 features |
| **Admin Portal** | Internal ops | 11 pages (5 disabled) | Partial (awaiting SMS) |

### Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Auth:** Firebase Authentication (email/password, custom tokens)
- **Database:** Firestore (21 collections)
- **Backend:** Cloud Functions (Express.js, Node 20, Asia-South1 region)
- **File Storage:** Firebase Storage (payslip PDFs)

### Critical Blocker
**SMS/OTP NOT WIRED** — All OTP generation is stubbed. Guards cannot self-register or reset passwords. Test only via Firestore console.

---

## PUBLIC WEBSITE WORKFLOWS {#public}

All public pages are read-only marketing content. No authentication required.

### WORKFLOW: Browse Public Website

**Name:** Public Website Navigation  
**Portal:** Public  
**Pages:** `index.html`, `pages/security.html`, `pages/facilities.html`, `pages/surveillance.html`, `pages/shop.html`, `pages/about.html`, `pages/contact.html`  
**Status:** Working  
**Steps:**

1. User opens https://vagt-services.web.app
2. Home page shows: company intro, client logos (EY, HatsOff, DS-Max, Quinbay), hero section
3. User clicks navigation menu → choose Security / Facilities / Surveillance / Shop / About / Contact
4. Security page: Security services offerings (text-only)
5. Facilities page: Facility management services (text-only)
6. Surveillance page: "Coming Soon" placeholder (⚠️ incomplete)
7. Shop page: Security equipment catalog (links to products)
8. About page: Company information
9. Contact page: Form visible (⚠️ backend not wired — submissions don't go anywhere)

**Known Issues:**
- Surveillance page is placeholder; needs real content
- Contact form submissions are not collected
- No hero photography or service page images
- No favicon on browser tab

**Analytics:** Zero tracking installed (no GA4, no Mixpanel, no visibility into traffic)

---

## AUTHENTICATION WORKFLOWS {#auth}

All three roles (Employee, Client, Admin) use the shared login hub at `portal.html` with role-based access.

### WORKFLOW 1: Employee Login (Email/Password)

**Name:** Guard Email/Password Login  
**Portal:** All (starts at portal.html)  
**Pages:** `pages/portal.html` → `pages/employee-portal.html`  
**API Route:** Firebase SDK (frontend uses `signInWithEmailAndPassword` directly — backend `/api/auth/login` is a stub)  
**Status:** Working  
**Steps:**

1. Guard opens browser → navigates to https://vagt-services.web.app/pages/portal.html
2. Selects "Employee" role from role picker card grid
3. Clicks "Email & Password" tab (default)
4. Enters email and password
5. Frontend calls Firebase SDK: `auth.signInWithEmailAndPassword(email, password)`
6. Auth returns ID token + refresh token
7. Frontend calls `auth.currentUser.getIdTokenResult()` to check `role` claim
8. If `role === 'employee'`: redirects to `/pages/employee-portal.html`
9. If `role !== 'employee'`: shows error "Access denied — wrong role"
10. Dashboard loads: displays check-in/out buttons, today's status, shifts, leave balance

**Status Codes:**
- 401: Wrong password or email not found
- 403: Account disabled (registration not approved yet)
- Success: Redirect to employee-portal.html with cached token

**Known Issues:**
- Requires admin to set `role: 'employee'` claim via SDK (`setCustomUserClaims`)
- Does NOT automatically work after registration approval — admin must manually set claim

---

### WORKFLOW 2: Employee Login (Keycode)

**Name:** Guard Keycode Card Login (No Password)  
**Portal:** Employee  
**Pages:** `pages/portal.html` → `pages/employee-portal.html`  
**API Route:** `POST /api/auth/guard/keycode-login`  
**Frontend:** Custom Token Exchange  
**Status:** Working  
**Purpose:** For guards without smartphones or struggling with passwords — they use a physical XXXX-XXXX keycode card

**Steps:**

1. Guard opens browser → portal.html → selects "Employee" → clicks "Guard Keycode" tab
2. Guard enters 8-character keycode (format: XXXX-XXXX, case-insensitive, normalised by backend)
3. Frontend requests geolocation permission (via `navigator.geolocation.getCurrentPosition()`)
4. If permission DENIED → error "Geolocation required"
5. If permission GRANTED → get latitude, longitude, accuracy (meters)
6. Frontend calls: `POST /api/auth/guard/keycode-login`
   ```json
   {
     "keycode": "ABCD-1234",
     "latitude": 12.9716,
     "longitude": 77.5946,
     "accuracy": 45.2,
     "device_info": "Mozilla/5.0... Samsung Galaxy"
   }
   ```
7. Backend:
   - Normalises keycode (uppercase, strip non-alphanumeric)
   - Looks up in `guard_keycodes` collection
   - If NOT FOUND → 401 "Invalid keycode"
   - If found but `active === false` → 403 "Keycode has been deactivated"
   - If found and active → logs sign-in event to `sign_in_events` collection (audit trail)
   - Generates Firebase Custom Token (1 hour expiry)
8. Frontend receives custom token → calls `auth.signInWithCustomToken(customToken)`
9. `onAuthStateChanged` fires → redirects to employee-portal.html

**Keycode Format:** XXXX-XXXX with unambiguous characters only (no 0, O, I, 1)  
**Restrictions:** One active keycode per guard; issuing a new keycode auto-revokes the old one  
**Audit Trail:** All sign-in attempts logged to `sign_in_events` (who, when, where via GPS, device)

**Status Codes:**
- 401: Keycode not found
- 403: Keycode deactivated
- 500: Server error (guard still sees error message)
- Success: Custom token returned; frontend exchanges it for session

---

### WORKFLOW 3: Client/Admin Login (Email/Password)

**Name:** Client or Admin Email/Password Login  
**Portal:** Client or Admin  
**Pages:** `pages/portal.html` → `pages/client-portal.html` or `pages/admin-portal.html`  
**API Route:** Firebase SDK (frontend only)  
**Status:** Working (for Client); ⚠️ Admin blocked by missing role claim  
**Steps:**

1. User opens portal.html
2. Selects "Client" or "Admin" role from picker
3. Enters email + password
4. Frontend calls Firebase SDK: `signInWithEmailAndPassword(email, password)`
5. ID token returned; frontend checks `role` claim:
   - If `role === 'client'` → redirect to client-portal.html
   - If `role === 'admin'` → redirect to admin-portal.html
   - If role is missing or wrong → error "Access denied"
6. User lands on their dashboard (client or admin)

**Admin Blocker:** The admin account was created at project inception but NEVER had the `role: 'admin'` claim set. Must run from Mac:
```bash
node set-admin-claim.js
# OR manually:
firebase functions:config:get | grep admin_uid
firebase auth:import --hash-algo=scrypt --round=8 <<EOF
[{"uid":"<admin_uid>","customClaims":"{\"role\":\"admin\"}"}]
EOF
```

**Status Codes:**
- Same as employee login (401 = wrong password, 403 = disabled account)

---

### WORKFLOW 4: Employee Self-Registration (Phone OTP)

**Name:** Guard Self-Registration — Step 1 & 2  
**Portal:** Public (starts at portal.html)  
**Pages:** `pages/portal.html` → registration form (embedded)  
**API Routes:** 
- `POST /api/auth/employee/register` (Step 1)
- `POST /api/auth/employee/verify-otp` (Step 2)
- `POST /api/auth/employee/resend-otp` (retry)
**Status:** ⚠️ Built but Untested (SMS not wired)  
**Prerequisites:** User has phone number and email

**Step 1: Initial Registration**

1. Guard opens portal.html → clicks "Don't have an account? Register"
2. Sees form: phone, email, password, site_id dropdown (optional)
3. Guard fills form and submits
4. Frontend calls: `POST /api/auth/employee/register`
   ```json
   {
     "phone": "919876543210",
     "email": "guard@example.com",
     "password": "SecurePass123!"
   }
   ```
5. Backend validates:
   - Password minimum 8 chars
   - Email not already in use (Firebase Auth check)
6. Backend:
   - Generates 6-digit OTP (crypto.randomInt(100000, 1000000))
   - Generates registration_token (reg_XXXX24hexchars)
   - Stores in `pending_registrations` collection:
     ```firestore
     {
       "phone": "919876543210",
       "email": "guard@example.com",
       "otp": "482910",
       "expires_at": now + 15 min,
       "verified": false,
       "created_at": now
     }
     ```
   - TODO: Sends OTP via SMS (MSG91) — CURRENTLY STUBBED
   - Returns: `{ "registration_token": "reg_..." }`
7. Frontend shows: "Enter the OTP sent to your phone" + input field
8. Guard does NOT receive SMS (OTP not wired); must look it up in Firestore console to proceed

**Step 2: OTP Verification**

1. Guard enters OTP (manually if testing, or from SMS if wired)
2. Frontend calls: `POST /api/auth/employee/verify-otp`
   ```json
   {
     "registration_token": "reg_...",
     "otp": "482910"
   }
   ```
3. Backend:
   - Looks up pending_registrations by token
   - Validates: OTP match, not expired, not already verified
   - If OTP wrong → 400 "Incorrect OTP" (guard can retry or request resend)
   - If expired → 400 "OTP expired" (guard must start registration over)
   - If correct:
     - Generates random temp password (base64 24 bytes — NOT stored)
     - Creates Firebase Auth account with DISABLED status (cannot log in yet)
     - Stores employee UID in pending_registrations.firebase_uid
     - Marks pending_registrations.verified = true
     - Logs activity: "New employee registration request from {phone}"
4. Backend returns: `{ "success": true }`
5. Frontend shows: "Registration verified. Awaiting admin approval."
6. Guard WAITS (account is disabled in Auth — cannot log in)

**Step 3: Admin Approval** (see WORKFLOW 7 below)

**Resend OTP**

- If guard didn't receive SMS: `POST /api/auth/employee/resend-otp`
- Generates fresh 6-digit OTP on same registration_token
- Old OTP is replaced; token stays same
- Frontend retries /verify-otp with new OTP

**Known Issues:**
- SMS not wired → guard never receives OTP → workflow breaks at step 1
- No way for guard to know their OTP without checking Firestore manually
- Password entered at registration is NEVER stored; guard sets real password only after admin approval (via SMS reset link — also not wired)
- Admin approval does NOT auto-send reset link; must be done manually by admin

---

### WORKFLOW 5: Password Reset (Forgot Password)

**Name:** Guard Password Reset  
**Portal:** Employee  
**Pages:** `pages/portal.html` → password reset form (embedded)  
**API Routes:**
- `POST /api/auth/forgot-password` (Step 1: request reset)
- `POST /api/auth/reset-password` (Step 2: verify OTP + set new password)
- `POST /api/auth/resend-reset-otp` (retry)
**Status:** ⚠️ Built but Untested (SMS not wired)  
**Purpose:** Guard forgot their password and wants to set a new one

**Step 1: Request Reset**

1. Guard on login page → clicks "Forgot Password?"
2. Guard enters: employee_id (e.g. VAGT-0001) OR email
3. Frontend calls: `POST /api/auth/forgot-password { identifier }`
4. Backend:
   - Tries to find user by email first
   - If not email, looks up employees collection by employee_id
   - If not found → 404 "No account found"
   - If found → generates OTP + reset_token (rst_XXXX)
   - Stores in password_reset_tokens collection:
     ```firestore
     {
       "uid": "<firebase_uid>",
       "otp": "123456",
       "expires_at": now + 15 min,
       "used": false,
       "created_at": now
     }
     ```
   - TODO: Sends OTP via SMS — CURRENTLY STUBBED
   - Returns: `{ "reset_token": "rst_...", "message": "OTP sent..." }`
5. Frontend shows: "Enter the OTP sent to your phone"

**Step 2: Reset Password**

1. Guard enters OTP + new password
2. Frontend calls: `POST /api/auth/reset-password`
   ```json
   {
     "reset_token": "rst_...",
     "otp": "123456",
     "new_password": "NewPassword456!"
   }
   ```
3. Backend:
   - Validates reset_token exists, not used, not expired
   - Validates OTP matches
   - Validates new_password length >= 8
   - If any validation fails → 400 error
   - If all pass:
     - Updates Firebase Auth account: `auth.updateUser(uid, { password: new_password })`
     - Marks token as used (prevents replay)
   - Returns: `{ "success": true }`
4. Frontend shows: "Password reset successfully. You can now log in."
5. Guard goes back to login page and logs in with new password

**Resend OTP**

- `POST /api/auth/resend-reset-otp { reset_token }`
- Generates new OTP on same reset_token
- TODO: Resends via SMS — CURRENTLY STUBBED

**Known Issues:**
- SMS not wired → workflow unusable in production
- Reset token has no user-friendly display (just a random string)

---

## EMPLOYEE PORTAL WORKFLOWS {#employee}

Only logged-in guards (role === 'employee') can access these features. All routes protected by `requireAuth` + `requireEmployee` middleware.

### WORKFLOW 6: Check-In

**Name:** Guard Check-In for Shift  
**Portal:** Employee  
**Page:** `pages/employee-portal.html` (dashboard section)  
**API Route:** `POST /api/attendance/checkin`  
**Status:** Working  
**Steps:**

1. Guard logs in → lands on employee-portal.html dashboard
2. Frontend calls: `GET /api/attendance/today` (to show current status)
3. Backend queries `attendance_logs` for today's entry by guard's UID
4. If found with check_in but no check_out → show "Check Out" button
5. If not found → show "Check In" button
6. Guard taps "Check In" button
7. Frontend calls: `POST /api/attendance/checkin`
8. Backend:
   - Safety check: blocks double check-in (guards tapping twice)
   - If already checked in today → 409 "Already checked in"
   - If not checked in → creates attendance_logs document:
     ```firestore
     {
       "employee_uid": "<uid>",
       "date": "2026-03-13" (todayStr()),
       "site_name": "Acme HQ" (denormalized from employee profile),
       "check_in": now,
       "check_out": null
     }
     ```
   - Logs activity: "Guard Name checked in"
9. Frontend updates dashboard: shows "Checked in at 09:45 AM" + "Check Out" button
10. Guard's status visible to admin in real-time

**Data Stored:**
- `check_in`: ISO timestamp (server time UTC)
- `site_name`: denormalized from employee doc (no extra lookup needed on reports)
- Duration calculated on checkout: `duration_minutes = (check_out - check_in) / 60000`

**Known Issues:**
- Uses Cloud Function server time (UTC) not IST; night shift crossings may show wrong date
- No GPS/location captured (unlike keycode login)
- Guards not currently assigned to sites (site_ids array empty) — placeholder data only

---

### WORKFLOW 7: Check-Out

**Name:** Guard Check-Out / End Shift  
**Portal:** Employee  
**Page:** `pages/employee-portal.html` (dashboard section)  
**API Route:** `POST /api/attendance/checkout`  
**Status:** Working  
**Steps:**

1. Guard (already checked in) taps "Check Out" button on dashboard
2. Frontend calls: `POST /api/attendance/checkout`
3. Backend:
   - Queries today's attendance_logs for this guard
   - If no entry found → 400 "No check-in found for today" (guard never checked in)
   - If entry already has check_out → 409 "Already checked out" (prevents double checkout)
   - If entry has check_in but no check_out:
     - Updates same document:
       ```firestore
       { "check_out": now, "duration_minutes": (now - check_in) / 60000 }
       ```
     - Logs activity: "Guard Name checked out"
4. Frontend updates dashboard:
   - Hides "Check Out" button
   - Shows "Shift complete: 8h 25m" (duration)
   - Shows "Check In" button again (for next day if applicable)
5. Attendance_logs doc now complete with full shift data

**Calculation:**
- Duration stored as minutes: (check_out.getTime() - check_in.getTime()) / 60000
- Shown to user as: hours and minutes (e.g. "8h 25m")

---

### WORKFLOW 8: View Attendance History

**Name:** Guard Attendance History  
**Portal:** Employee  
**Page:** `pages/employee-portal.html` (Attendance tab)  
**API Route:** `GET /api/attendance/today` (current) / manual history view (future)  
**Status:** Working (today's only; full history not yet built)  
**Steps:**

1. Guard opens employee-portal.html → "Attendance" tab
2. Shows today's check-in/check-out status
3. No past history view yet (would need additional UI + query to attendance_logs with date range)

**Future Enhancement:** Add date picker → `GET /api/attendance?date=YYYY-MM-DD` for any past date

---

### WORKFLOW 9: Leave Request & Approval

**Name:** Guard Apply for Leave  
**Portal:** Employee → Admin approval  
**Pages:** `pages/employee-portal.html` (employee side) → `pages/admin-portal.html` (admin side)  
**API Routes:**
- Employee: `GET /api/leave/balance`, `GET /api/leave/history`, `POST /api/leave/apply`
- Admin: `GET /api/admin/pending-leaves`, `POST /api/admin/leaves/:id/approve`, `POST /api/admin/leaves/:id/reject`
**Status:** Working  
**Steps (Employee):**

1. Guard opens employee-portal.html → "Leave" section
2. Frontend calls: `GET /api/leave/balance`
3. Backend returns:
   ```json
   {
     "balance_days": 12,
     "leave_types": [
       { "type": "casual", "label": "Casual Leave", "balance": 6 },
       { "type": "sick",   "label": "Sick Leave",   "balance": 4 },
       { "type": "earned", "label": "Earned Leave", "balance": 2 }
     ]
   }
   ```
4. Guard fills form: leave_type (casual/sick/earned), from_date, to_date, reason
5. Guard submits
6. Frontend calls: `POST /api/leave/apply`
   ```json
   {
     "leave_type": "casual",
     "from_date": "2026-03-20",
     "to_date": "2026-03-22",
     "reason": "Personal emergency"
   }
   ```
7. Backend:
   - Validates leave_type is one of casual/sick/earned
   - Does NOT check if balance is sufficient (admin will reject if needed)
   - Creates leave_requests document:
     ```firestore
     {
       "employee_uid": "<uid>",
       "leave_type": "casual",
       "from_date": "2026-03-20",
       "to_date": "2026-03-22",
       "reason": "Personal emergency",
       "status": "pending",
       "applied_at": now
     }
     ```
   - Logs activity: "Guard Name applied for casual leave"
8. Frontend shows: "Leave request submitted. Awaiting approval."
9. Guard can view history: `GET /api/leave/history` → shows all past/pending requests

**Steps (Admin):**

1. Admin logs in → admin-portal.html → "Pending Leaves" section
2. Frontend calls: `GET /api/admin/pending-leaves`
3. Backend returns list of all pending leave_requests (oldest first, FIFO)
4. Admin reviews request → clicks "Approve" or "Reject"
5. If Approve: `POST /api/admin/leaves/:id/approve`
   - Backend:
     - Updates leave_requests doc: `status: 'approved'`
     - Decrements leave_balance on employee doc:
       ```firestore
       employee.leave_balance[leave_type] -= days_requested
       ```
     - Logs activity: "Guard Name's leave approved"
6. If Reject: `POST /api/admin/leaves/:id/reject`
   - Backend:
     - Updates leave_requests doc: `status: 'rejected'`
     - Logs activity: "Guard Name's leave rejected"
7. Guard sees updated status on next refresh of `/api/leave/history`

**Initial Leave Balance:**
- Set at admin approval (workflow 14): casual: 6, sick: 4, earned: 2 days
- No automatic yearly reset (TODO: add cron job for FY April 1st)

**Known Issues:**
- No balance pre-check on apply (admin must catch over-approvals)
- No SMS notification to guard when approved/rejected (blocked by SMS integration)

---

### WORKFLOW 10: View Payslips

**Name:** Guard Download Monthly Payslip (PDF)  
**Portal:** Employee  
**Page:** `pages/employee-portal.html` (Payroll tab)  
**API Routes:**
- `GET /api/payslips` (list last 24 months)
- `GET /api/payslips/:id/download` (generate/serve PDF)
**Status:** Working  
**Steps:**

1. Guard opens employee-portal.html → "Payroll" tab
2. Frontend calls: `GET /api/payslips`
3. Backend returns list of last 24 payslips for this employee:
   ```json
   [
     {
       "id": "<payslip_id>",
       "month": 3,
       "year": 2026,
       "month_label": "March 2026",
       "net_pay": 15500,
       "url": null
     },
     ...
   ]
   ```
4. If `url === null`: PDF not yet generated; show "Not available yet"
5. If `url` has value: show "Download" button
6. Guard clicks "Download" on a payslip
7. Frontend calls: `GET /api/payslips/:id/download`
8. Backend:
   - Fetches payslip doc
   - Security check: verify employee_uid matches current user
   - Checks if `pdf_path` field exists in Firestore:
     - **If exists:** fetch PDF from Firebase Storage → serve directly
     - **If not exists:** generate PDF in memory using pdfkit library:
       - Builds PDF document with:
         - VAGT branding header (navy + amber colors)
         - Employee name, ID, generation date
         - Earnings table (basic salary, allowances, gross)
         - Deductions (shown as flat amount; future: EPF, ESI, TDS)
         - Net pay (prominently displayed)
         - Footer: "Computer-generated, no signature required"
       - Uploads PDF to Storage at `payslips/{payslip_id}.pdf`
       - Stamps pdf_path on Firestore doc
       - Serves PDF to guard
9. Guard's browser downloads: `VAGT-Payslip-VAGT-0001-2026-03.pdf`

**PDF Layout:**
- A4 size, 50px margins
- Header band: navy background, white VAGT logo, amber "PAYSLIP" label
- Employee box: rounded rect with name, employee ID, generated date
- Earnings section: basic salary, allowances → gross pay
- Deductions section: total deductions
- Net pay: large amber text on navy background
- Footer: company address + generation note

**Payroll Calculation (Current):**
- ⚠️ PLACEHOLDER ONLY: basic_salary * 0.98 (flat 2% deduction)
- NOT production-ready; missing:
  - EPF (12% employee + 12% employer, capped ₹15,000 basic)
  - ESI (0.75% employee + 3.25% employer, if gross ≤ ₹21,000)
  - TDS (if applicable)
  - Attendance-based proration (days present from attendance_logs)
  - HRA, allowances from employee profile

**Storage Caching:**
- First download: generates PDF → stores in Storage (fire-and-forget on failure)
- Subsequent downloads: fetches from Storage (fast)
- Non-fatal: if Storage upload fails, guard still gets PDF; will retry next download

**Known Issues:**
- Payroll computation is a placeholder; needs proper GST + legal compliance
- Only last 24 months returned; paginate for older slips
- No ability to view payslips for future months (not yet generated)

---

### WORKFLOW 11: View Schedule

**Name:** Guard View Assigned Shifts  
**Portal:** Employee  
**Page:** `pages/employee-schedule.html`  
**API Route:** `GET /api/employee/schedule`  
**Status:** Working  
**Steps:**

1. Guard opens employee-portal.html → "Schedule" page
2. Frontend calls: `GET /api/employee/schedule` (no params = next 14 days)
   - Optional: `?week_start=2026-03-15` for specific week view
3. Backend:
   - Fetches shifts collection filtered by:
     - `employee_uid === current user`
     - `date >= today` (or >= week_start if provided)
   - Returns up to 14 shifts:
     ```json
     [
       {
         "id": "<shift_id>",
         "date": "2026-03-15",
         "site_name": "Acme HQ",
         "site_address": "Downtown Plaza, 5th Floor",
         "shift_type": "morning",
         "start_time": "06:00",
         "end_time": "14:00"
       },
       ...
     ]
     ```
4. Frontend displays as a calendar grid or list:
   - Date | Site | Shift Type | Time
5. Guard can see their upcoming 2 weeks at a glance
6. Clicking a shift shows: site address, guard notes (if any)

**Shift Types:**
- morning: 06:00–14:00
- afternoon: 14:00–22:00
- night: 22:00–06:00 (crosses midnight)

**Known Issues:**
- No composite Firestore index for (employee_uid, date) → queries may be slow
- No real-time updates if admin adds shift while guard is viewing
- Cannot view past shifts (useful for historical tracking, not yet built)

---

### WORKFLOW 12: View Deployed Sites

**Name:** Guard View My Assigned Sites  
**Portal:** Employee  
**Page:** `pages/employee-portal.html` (dashboard) or separate sites view  
**API Route:** `GET /api/employee/sites`  
**Status:** Working  
**Steps:**

1. Guard opens employee-portal.html
2. Frontend calls: `GET /api/employee/sites`
3. Backend:
   - Fetches guard's employee doc
   - Extracts `site_ids` array (e.g. ["site_123", "site_456"])
   - Fetches all site docs in parallel (Promise.all)
   - Returns:
     ```json
     [
       { "id": "site_123", "name": "Acme HQ" },
       { "id": "site_456", "name": "Tech Park B" }
     ]
     ```
4. Frontend displays as list or cards showing guard's assigned sites

**Known Issues:**
- Current implementation: guard's `site_ids` array is EMPTY (no sites assigned yet)
- If a site is deleted without cleaning up employee records, it's silently skipped
- No on-site address or contact info shown (could be added to response)

---

### WORKFLOW 13: File Incident Report

**Name:** Guard Report an Incident  
**Portal:** Employee  
**Page:** `pages/employee-incidents.html`  
**API Routes:**
- `GET /api/employee/incidents` (view history)
- `POST /api/employee/incidents` (file new incident)
**Status:** Working  
**Steps:**

1. Guard opens employee-portal.html → "Incidents" tab
2. Sees: form at top + history list below
3. Guard fills form:
   - Type: select from dropdown (trespassing, suspicious_activity, theft, fire, equipment_failure, medical, other)
   - Severity: select (low, medium, high, critical)
   - Description: free text (required)
   - Optional: site_id (dropdown), occurred_at (timestamp), persons_involved, action_taken
4. Guard submits
5. Frontend calls: `POST /api/employee/incidents`
   ```json
   {
     "type": "suspicious_activity",
     "severity": "high",
     "site_id": "site_123",
     "occurred_at": "2026-03-13T14:30:00Z",
     "description": "Unknown person loitering near north gate",
     "persons_involved": "1 male, ~30 years old, blue shirt",
     "action_taken": "Confronted and asked to leave; obliged peacefully"
   }
   ```
6. Backend:
   - Validates severity is one of low/medium/high/critical
   - Fetches employee name (for denormalization)
   - Fetches site name if site_id provided
   - Generates reference number: `INC-{year}-{4 random digits}` (e.g. INC-2026-7382)
   - Creates incidents document:
     ```firestore
     {
       "employee_uid": "<uid>",
       "employee_name": "John Doe",
       "type": "suspicious_activity",
       "severity": "high",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "occurred_at": timestamp,
       "description": "...",
       "persons_involved": "...",
       "action_taken": "...",
       "reference_number": "INC-2026-7382",
       "status": "submitted",
       "submitted_at": now
     }
     ```
   - If severity is high/critical:
     - Logs activity with ⚠️ prefix: "⚠️ HIGH incident filed by John: INC-2026-7382"
     - TODO: Send SMS to duty manager (blocked by MSG91 integration)
   - Otherwise logs normally
7. Frontend shows: "Incident reported. Reference: INC-2026-7382"
8. Guard can view history: `GET /api/employee/incidents` (last 50, newest first)

**Incident Statuses:**
- submitted: guard filed it
- acknowledged: admin has reviewed
- resolved: admin marked as resolved
- (Can be updated by admin only)

**Known Issues:**
- HIGH/CRITICAL severity doesn't trigger SMS (MSG91 not wired)
- Reference number not 100% collision-proof if >1000 incidents/year (use UUID for better scale)
- No way for guard to see admin's response or update their own incident status

---

### WORKFLOW 14: Guest Entry & Exit Logging

**Name:** Guard Log Visitor Entry, Generate QR Slip, Mark Exit  
**Portal:** Employee  
**Page:** `pages/employee-guests.html`  
**API Routes:**
- `POST /api/guest/entry` (log entry + generate QR)
- `POST /api/guest/exit/:token` (mark exit by token)
- `GET /api/guest/active` (list active visitors)
- `GET /api/guest/history` (past visitors for a date)
**Status:** Working  
**Steps (Entry):**

1. Guard opens employee-guests.html → "New Visitor" form
2. Guard fills:
   - Visitor name (required)
   - Visitor type: dropdown (vendor, delivery, guest, tradesman)
   - Purpose: dropdown/text (e.g. "Delivery", "Meeting", "Maintenance")
   - Visiting: text (which building/floor/department, e.g. "Floor 3, Accounts Dept")
   - Site: optional dropdown (auto-filled from guard's assigned site)
3. Guard submits
4. Frontend calls: `POST /api/guest/entry`
   ```json
   {
     "visitor_name": "Rajesh Kumar",
     "visitor_type": "vendor",
     "purpose": "Supply Delivery",
     "visiting": "3rd Floor, Stock Room",
     "site_id": "site_123"
   }
   ```
5. Backend:
   - Validates all required fields are present
   - Fetches guard's employee doc (name, site_name, site_id)
   - Generates 8-character token: `crypto.randomBytes(4).toString('hex').toUpperCase()` (e.g. "A3F9C12B")
   - Generates QR code as PNG data URL: encodes just the token (8 chars)
   - Creates guest_logs document:
     ```firestore
     {
       "token": "A3F9C12B",
       "visitor_name": "Rajesh Kumar",
       "visitor_type": "vendor",
       "purpose": "Supply Delivery",
       "visiting": "3rd Floor, Stock Room",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "guard_uid": "<uid>",
       "guard_name": "John Doe",
       "entry_time": now,
       "exit_time": null,
       "status": "active",
       "expires_at": now + 8 hours
     }
     ```
   - Returns:
     ```json
     {
       "id": "<doc_id>",
       "token": "A3F9C12B",
       "qr_data_url": "data:image/png;base64,iVBOR...",
       "entry_time": "2026-03-13T10:30:00Z",
       "expires_at": "2026-03-13T18:30:00Z",
       "visitor_name": "Rajesh Kumar",
       "visiting": "3rd Floor, Stock Room",
       "site_name": "Acme HQ"
     }
     ```
6. Frontend opens modal: shows QR code + token (8-letter code like "A3F9C12B")
   - Guard can print or screenshot
   - Or show on phone to visitor
   - Visitor keeps a paper slip with token + name + time
7. Frontend hides modal; refreshes "Active Visitors" list
8. Visitor appears in list with token, name, type, entry time

**Steps (Exit by Token):**

1. Visitor leaves → guard opens "Mark Exit" section
2. Guard can either:
   - **Option A (Token Entry):** Type/scan 8-char token from QR slip
     - Validates token format: 8 hex characters (A-F, 0-9)
   - **Option B (Quick Mark):** Click "Mark Exit" button next to visitor name in active list
3. Frontend calls: `POST /api/guest/exit/:token` (both options)
   ```
   POST /api/guest/exit/A3F9C12B
   ```
4. Backend:
   - Looks up guest_logs by token where status === 'active'
   - If not found → 404 "No active guest entry for this token"
   - If found → updates same document:
     ```firestore
     {
       "status": "exited",
       "exit_time": now
     }
     ```
   - Returns: `{ "success": true, "exit_time": "2026-03-13T11:45:00Z" }`
5. Frontend updates list: visitor moves from "Active" to "Exited"
6. Visitor no longer appears in active visitors list

**Viewing History:**

- Guard calls: `GET /api/guest/active` (all current visitors logged by this guard)
- Guard calls: `GET /api/guest/history?date=2026-03-13` (all visitors for a date, by this guard)
- Returns list of guests (active + exited)

**QR Code:**
- Generated on server (QRCode npm library)
- Encoded data: token only (8 characters) — minimal payload
- PNG format with VAGT colors (dark navy #0a1628, light #ffffff)
- Size: 260x260 px with margin of 2

**Auto-Expiry:**
- Visitor marked as expired after 8 hours in "active" status
- Scheduled function (every 60 min) updates expired records to "expired" status
- Can be manually checked out before expiry

**Known Issues:**
- Token format could be confused (8 hex chars vs QR decoding)
- No photo capture of visitor (requested in future enhancements)
- No integration with building access systems
- 8-hour expiry is fixed (not configurable per site)

---

### WORKFLOW 15: Beat Patrol (NFC/QR/Manual Checkpoint)

**Name:** Guard Conduct Building Tour / Beat Patrol  
**Portal:** Employee  
**Page:** `pages/employee-patrol.html`  
**API Routes:**
- `POST /api/patrol/checkpoint` (log a scan)
- `GET /api/patrol/checkpoints` (list checkpoints)
- `GET /api/patrol/today` (today's scan log)
**Status:** Working (3 scan methods available)  
**Purpose:** Guard taps NFC tags at fixed building checkpoints throughout shift to prove they did their tour

**Checkpoint Setup (Admin):**
- Admin pre-registers NFC tag IDs in patrol_checkpoints collection
- Each checkpoint has: label (e.g. "North Gate"), nfc_tag_id (e.g. "NFC:ABC123"), site_id, active flag
- Guard's phone can scan these tags via Web NFC API or QR code

**Steps (Guard Scanning):**

1. Guard opens employee-patrol.html → "Beat Patrol" section
2. Frontend loads 2 lists via parallel queries:
   - `GET /api/patrol/checkpoints` → list of active checkpoints at guard's site
   - `GET /api/patrol/today` → guard's scans from today (if any)
3. Frontend shows checkpoints as cards/list with status (unscanned, ✓ scanned, time)
4. Guard approaches first checkpoint (e.g. North Gate)
5. Guard chooses scan method:

   **Method A: NFC (Web NFC API)**
   - Frontend calls: `navigator.nfc.readNextMessage()` (if browser supports Web NFC)
   - Guard taps phone to NFC tag
   - Tag ID read → Frontend extracts it
   - Guard sees: "Scanned checkpoint: North Gate at 10:30 AM"

   **Method B: QR Code (Camera Scan)**
   - Frontend opens camera via MediaDevices API
   - Frontend uses QR decoder library to find tag ID in QR data
   - Guard scans printed QR label on wall
   - Tag ID extracted

   **Method C: Manual (No Hardware)**
   - Dropdown list of checkpoint labels
   - Guard selects their current checkpoint manually
   - Used if tag fails or not present
   - Scan method recorded as 'manual'

6. Any method → extracts `nfc_tag_id` → Frontend calls: `POST /api/patrol/checkpoint`
   ```json
   {
     "nfc_tag_id": "NFC:ABC123",
     "scan_method": "nfc|qr|manual"
   }
   ```
7. Backend:
   - Looks up checkpoint by nfc_tag_id (must be active)
   - If not found → 404 "Checkpoint not found"
   - If found → extracts checkpoint_id, label, site_name
   - Fetches guard name (denormalization)
   - Creates patrol_logs document:
     ```firestore
     {
       "guard_uid": "<uid>",
       "guard_name": "John Doe",
       "checkpoint_id": "<checkpoint_id>",
       "checkpoint_label": "North Gate",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "nfc_tag_id": "NFC:ABC123",
       "scan_method": "nfc",
       "scanned_at": now
     }
     ```
   - Returns:
     ```json
     {
       "id": "<log_id>",
       "checkpoint_label": "North Gate",
       "site_name": "Acme HQ",
       "scanned_at": "2026-03-13T10:30:00Z"
     }
     ```
8. Frontend:
   - Updates checkpoint card: marks ✓ as scanned
   - Shows timestamp: "Scanned at 10:30 AM"
   - Color changes (green for completed)
   - Toast notification: "Checkpoint logged"
9. Guard moves to next checkpoint
10. At end of shift, admin/client can verify all checkpoints were covered

**Viewing Today's Log:**

- `GET /api/patrol/today?date=2026-03-13` → returns guard's all scans for that date
  ```json
  [
    {
      "id": "<log_id>",
      "checkpoint_label": "North Gate",
      "site_name": "Acme HQ",
      "scan_method": "nfc",
      "scanned_at": "2026-03-13T10:30:00Z"
    },
    {
      "checkpoint_label": "Main Lobby",
      "site_name": "Acme HQ",
      "scan_method": "nfc",
      "scanned_at": "2026-03-13T11:15:00Z"
    },
    ...
  ]
  ```

**Admin Checkpoint Management:**
- `GET /api/admin/patrol/checkpoints` → list all checkpoints with QR code data URLs for printing
- `POST /api/admin/patrol/checkpoints` → register new checkpoint with NFC tag ID
- `DELETE /api/admin/patrol/checkpoints/:id` → soft-delete (mark inactive, preserve logs)

**Known Issues:**
- Web NFC API not widely supported (Chrome/Edge on Android only)
- No physical NFC tags yet (blocked on hardware delivery)
- QR code reading requires good lighting + image quality
- No guidance for guard if wrong checkpoint tapped
- No map view of checkpoint locations (future enhancement)

---

## CLIENT PORTAL WORKFLOWS {#client}

Only logged-in clients (role === 'client') can access these features. Clients are facility managers or HR contacts who contracted VAGT for guard services.

### WORKFLOW 16: Client Complaint / Service Request

**Name:** Client File a Complaint or Service Request  
**Portal:** Client  
**Page:** `pages/client-portal.html` (dashboard form) or separate complaints page  
**API Routes:**
- `POST /api/complaints` (file)
- `GET /api/complaints` (list)
**Status:** Working  
**Steps:**

1. Client logs in → client-portal.html
2. Sees "Report an Issue" form on dashboard (or dedicated page)
3. Client fills:
   - Type: select (complaint, service_request, feedback, emergency)
   - Priority: select (low, medium, high, urgent) — defaults to medium
   - Subject: text (e.g. "Guard not present at 2 PM")
   - Description: long text (details of issue)
   - Optional: site dropdown (which site is issue at)
4. Client submits
5. Frontend calls: `POST /api/complaints`
   ```json
   {
     "type": "complaint",
     "priority": "high",
     "subject": "Guard no-show at north gate",
     "description": "Expected guard at 2 PM for afternoon shift. No one showed up. Had to cover manually until 3 PM.",
     "site_id": "site_123"
   }
   ```
6. Backend:
   - Validates type is one of allowed types
   - Validates priority is one of allowed priorities (or defaults to medium)
   - Fetches client name (for admin visibility)
   - Generates ticket ID: `TKT-{year}-{3 random hex bytes}` (e.g. TKT-2026-AB4F9E)
   - Creates complaints document:
     ```firestore
     {
       "client_uid": "<uid>",
       "client_name": "Acme Corp",
       "ticket_id": "TKT-2026-AB4F9E",
       "type": "complaint",
       "priority": "high",
       "subject": "Guard no-show at north gate",
       "description": "...",
       "status": "open",
       "created_at": now,
       "admin_note": null
     }
     ```
   - Logs activity: "New complaint from Acme Corp: Guard no-show at north gate"
   - Returns: `{ "id": "<doc_id>", "status": "open", "created_at": "...", "ticket_id": "TKT-..." }`
7. Frontend shows: "Ticket created: TKT-2026-AB4F9E. We'll investigate shortly."
8. Client can view complaints list: `GET /api/complaints` → shows all client's tickets (last 50, newest first)
   ```json
   [
     {
       "id": "<doc_id>",
       "ticket_id": "TKT-2026-AB4F9E",
       "type": "complaint",
       "priority": "high",
       "subject": "Guard no-show...",
       "status": "open",
       "created_at": "2026-03-13T14:00:00Z"
     },
     ...
   ]
   ```

**Statuses:**
- open: just filed, awaiting admin review
- in_progress: admin is investigating
- resolved: admin has addressed the issue

**Admin Update (via admin portal):**
- `POST /api/admin/complaints/:id/status`
  ```json
  {
    "status": "in_progress",
    "admin_note": "Spoke to guard supervisor. Guard was sick. Replacement deployed."
  }
  ```
- Client sees updated status + note on next refresh

**Ticket ID Format:**
- TKT-{year}-{6 hex chars} = easy reference in emails/calls (not 100% collision-proof but sufficient for this scale)

**Known Issues:**
- No real-time notifications to client when ticket status updates
- Admin note visible to client (should be fine; transparency is good)
- No SLA tracking (no "response within 4 hours" enforcement)

---

### WORKFLOW 17: Client View Deployment Summary

**Name:** Client Dashboard Overview  
**Portal:** Client  
**Page:** `pages/client-portal.html` (dashboard top section)  
**API Route:** `GET /api/client/deployment-summary`  
**Status:** Working  
**Purpose:** Client sees at-a-glance: how many guards on duty, sites covered, open tickets, incidents this month

**Steps:**

1. Client opens client-portal.html
2. Frontend calls: `GET /api/client/deployment-summary`
3. Backend (3 parallel queries):
   - Fetch all sites where client_uid === client
   - Sum up guards_deployed field from all sites (manually set by admin)
   - Count sites with coverage_status !== 'none'
   - Fetch all complaints where client_uid === client && status in ['open', 'in_progress']
   - Fetch all incidents where site_client_uid === client && submitted_at >= start of this calendar month
4. Returns:
   ```json
   {
     "guards_on_duty": 8,
     "sites_covered": 3,
     "incidents_this_month": 2,
     "open_tickets": 1
   }
   ```
5. Frontend displays as 4 stat cards on dashboard:
   - 🛡️ 8 Guards on Duty
   - 🏢 3 Sites Covered
   - ⚠️ 2 Incidents This Month
   - 🎟️ 1 Open Ticket

**Known Issues:**
- guards_on_duty is manually maintained by admin (not computed from real check-ins)
- If admin doesn't update site records when deploying/removing guards, number is stale
- Better approach: count real attendance check-ins from today instead of stored number

---

### WORKFLOW 18: Client View Invoices

**Name:** Client View Billing & Download Invoices  
**Portal:** Client  
**Page:** `pages/client-invoices.html`  
**API Routes:**
- `GET /api/client/invoices/summary` (outstanding, overdue, paid YTD, fiscal year)
- `GET /api/client/invoices` (full invoice list)
**Status:** Working  
**Steps:**

1. Client opens client-portal.html → "Invoices" page
2. Frontend calls: `GET /api/client/invoices/summary`
3. Backend:
   - Fetches all invoices for this client
   - Iterates through, grouping by status:
     - Unpaid (not yet due): add to outstanding
     - Overdue (past due date, unpaid): add to both outstanding AND overdue
     - Paid (within current Indian FY only): add to paid_ytd
     - Cancelled: ignore
   - Current FY calculation: if today is Jan 2026 → FY is 2025–26 (started Apr 1, 2025)
   - Returns:
     ```json
     {
       "outstanding_amount": 45000,
       "overdue_amount": 12000,
       "paid_ytd": 1800000,
       "total_invoices": 18,
       "fiscal_year_label": "FY 2025–26"
     }
     ```
4. Frontend displays summary box at top of page:
   - Outstanding: ₹45,000 (red if any overdue)
   - Paid This Year: ₹18,00,000 (green)
   - FY Label: "FY 2025–26"
5. Frontend calls: `GET /api/client/invoices` (last 50 invoices, newest first)
6. Backend returns:
   ```json
   [
     {
       "id": "<doc_id>",
       "invoice_number": "VAGT-2026-0042",
       "period_label": "February 2026",
       "issued_date": "2026-02-28",
       "due_date": "2026-03-14",
       "amount": 125000,
       "status": "unpaid",
       "paid_amount": null,
       "pdf_url": "https://firebasestorage.googleapis.com/... /invoice_2026_02.pdf"
     },
     ...
   ]
   ```
7. Frontend displays as table/list:
   - Invoice # | Period | Amount | Status | Action
8. Client clicks "Download" or "View" → opens pdf_url (PDF hosted on Firebase Storage)

**Invoice Status Values:**
- unpaid: issued but not yet past due
- overdue: past due_date, still unpaid (shown in red)
- paid: payment received (shown in green, shows paid amount if partial)
- cancelled: void (greyed out, ignored in summaries)

**Indian Fiscal Year Logic:**
- FY 2025–26 = Apr 1, 2025 – Mar 31, 2026
- Current year (as of date): 2026
- FY start year: 2026 - 1 = 2025
- FY label: `FY 2025–26`
- When calculating paid_ytd: only count invoices where issued_date >= '2025-04-01'

**PDF Generation:**
- Currently: admin uploads PDF manually → pastes URL into invoice doc's pdf_url field
- Future: auto-generate with pdfkit (must include GST, GSTIN, HSN/SAC 998521, 18% GST)

**Known Issues:**
- No auto-generation of invoices (manual process)
- No email alerts when invoices are issued
- Overdue calculation doesn't account for holidays or grace periods
- No installment/partial payment tracking (stored in paid_amount but not deeply tracked)

---

### WORKFLOW 19: Client View Reports

**Name:** Client View Daily Guard Reports  
**Portal:** Client  
**Page:** `pages/client-reports.html`  
**API Route:** `GET /api/client/reports`  
**Status:** Working  
**Steps:**

1. Client opens client-portal.html → "Reports" page
2. Frontend shows optional filters: site (dropdown), report type (dropdown), month (date input)
3. Frontend calls: `GET /api/client/reports` with optional query params:
   ```
   GET /api/client/reports?site=site_123&type=daily&month=2026-03
   ```
4. Backend:
   - Fetches all daily_reports where site_client_uid === client's UID
   - Applies filters (site, report_type, month range)
   - Orders by date descending
   - Limit 50
   - Returns:
     ```json
     [
       {
         "id": "<doc_id>",
         "date": "2026-03-13",
         "site_id": "site_123",
         "site_name": "Acme HQ",
         "report_type": "daily",
         "guard_name": "John Doe",
         "summary": "All checkpoints covered. No incidents. Guard #2 was late by 15 min.",
         "details": "..."
       },
       ...
     ]
     ```
5. Frontend displays as list:
   - Date | Site | Guard | Summary
6. Client clicks a report → sees full details (expanded view)

**Report Fields:**
- date: YYYY-MM-DD when report was filed
- site_name: which site (e.g. "Acme HQ")
- guard_name: which guard filed it
- report_type: typically "daily" (future: "incident", "weekly", etc.)
- summary: brief overview (max 200 chars)
- details: full narrative

**Known Issues:**
- Reports are filed manually by guards (no automation)
- No structured data (just free-text summaries)
- Query requires composite Firestore index on (site_client_uid, date)
- No analytics/metrics on report trends

---

### WORKFLOW 20: Client View Patrol Coverage

**Name:** Client View Beat Patrol Logs  
**Portal:** Client  
**Page:** `pages/client-patrol.html`  
**API Route:** `GET /api/client/patrol`  
**Status:** Working  
**Purpose:** Client can see: which guards scanned which checkpoints at what times → confidence that premise is being patrolled

**Steps:**

1. Client opens client-portal.html → "Patrol Coverage" page
2. Frontend shows optional date picker: defaults to today
3. Frontend calls: `GET /api/client/patrol?date=2026-03-13`
4. Backend:
   - Fetches all sites where client_uid === client
   - For each site, queries patrol_logs where:
     - site_id in [client's site IDs]
     - scanned_at between start-of-day and end-of-day
   - Chunks sites into groups of 30 (Firestore 'in' limit) and queries in parallel
   - Returns all logs, sorted by scanned_at descending:
     ```json
     [
       {
         "id": "<log_id>",
         "checkpoint_label": "North Gate",
         "site_name": "Acme HQ",
         "guard_name": "John Doe",
         "scan_method": "nfc",
         "scanned_at": "2026-03-13T06:30:00Z"
       },
       {
         "checkpoint_label": "Main Lobby",
         "site_name": "Acme HQ",
         "guard_name": "John Doe",
         "scan_method": "nfc",
         "scanned_at": "2026-03-13T07:45:00Z"
       },
       ...
     ]
     ```
5. Frontend displays as timeline or table:
   - Time | Guard | Checkpoint | Site | Method
6. Client sees: "John covered North Gate at 6:30 AM, Main Lobby at 7:45 AM, etc."

**Scan Method Values:**
- nfc: Web NFC API (tag tap)
- qr: QR code scanned
- manual: dropdown selected (no hardware)

**Known Issues:**
- No map view of checkpoint locations
- No "gaps" detection (e.g. "checkpoint C not covered for 4 hours")
- No integration with building floor plans

---

### WORKFLOW 21: Client View Visitor Log

**Name:** Client View Guest Entries & Exits  
**Portal:** Client  
**Page:** `pages/client-guests.html`  
**API Route:** `GET /api/client/guests`  
**Status:** Working  
**Purpose:** Client can see all visitors logged at their sites → transparency on who came in/out

**Steps:**

1. Client opens client-portal.html → "Visitor Log" page
2. Frontend shows optional date picker: defaults to today
3. Frontend calls: `GET /api/client/guests?date=2026-03-13`
4. Backend:
   - Fetches all sites where client_uid === client
   - Queries guest_logs where:
     - site_id in [client's site IDs]
     - entry_time between start-of-day and end-of-day
   - Chunks sites (30-site limit per query) and queries in parallel
   - Returns all logs, sorted by entry_time descending:
     ```json
     [
       {
         "id": "<log_id>",
         "token": "A3F9C12B",
         "visitor_name": "Rajesh Kumar",
         "visitor_type": "vendor",
         "purpose": "Supply Delivery",
         "visiting": "3rd Floor, Stock Room",
         "site_name": "Acme HQ",
         "guard_name": "John Doe",
         "entry_time": "2026-03-13T10:00:00Z",
         "exit_time": "2026-03-13T10:45:00Z",
         "status": "exited"
       },
       {
         "visitor_name": "Sarah Mitchell",
         "visitor_type": "guest",
         "purpose": "Meeting",
         "visiting": "Conference Room A",
         "status": "active",
         "entry_time": "2026-03-13T14:30:00Z",
         "exit_time": null
       },
       ...
     ]
     ```
5. Frontend displays as table:
   - Name | Type | Purpose | Where | Entry Time | Exit Time | Status (in/out)
6. Client can see active visitors still on premises (red indicator) vs exited (green)
7. Client clicks a visitor → sees duration on-site, which guard logged them, etc.

**Visitor Types:**
- vendor: supplier/tradesman
- delivery: package/goods delivery
- guest: visitor/meeting attendee
- tradesman: maintenance/repair worker

**Status Values:**
- active: entered, not yet exited
- exited: marked as left
- expired: >8 hours in active status (auto-expired by scheduled function)

**Known Issues:**
- No photo verification (could add in future)
- No integration with building entry cards/badges
- 8-hour expiry is not configurable per site

---

## ADMIN PORTAL WORKFLOWS {#admin}

All admin routes require role === 'admin' AND valid Firebase ID token. Routes protected by `requireAuth` + `requireAdmin` middleware.

**CRITICAL BLOCKER:** Admin account exists but has NO `role: 'admin'` claim set. Must run from Mac:
```bash
# Method 1: Use Firebase Console → Authentication → Custom Claims
# Method 2: Run script: node set-admin-claim.js
```

### WORKFLOW 22: Admin Dashboard Overview

**Name:** Admin Dashboard Summary  
**Portal:** Admin  
**Page:** `pages/admin-portal.html` (main dashboard)  
**API Routes:**
- `GET /api/admin/overview` (4 stat numbers)
- `GET /api/admin/activity` (real-time activity feed)
**Status:** Working  
**Steps:**

1. Admin logs in → admin-portal.html
2. Frontend calls: `GET /api/admin/overview`
3. Backend (5 parallel queries):
   - Count all employees (limit 500)
   - Count pending registrations (verified but not approved)
   - Count open/in_progress complaints
   - Count pending leave requests
   - Count today's attendance logs
4. Returns:
   ```json
   {
     "employees": {
       "active": 45,
       "pending_approval": 3,
       "total": 48
     },
     "attendance": {
       "checked_in": 38,
       "total_on_duty": 40
     },
     "tickets": {
       "open": 5,
       "in_progress": 2,
       "urgent": 1
     },
     "leaves": {
       "pending": 4
     }
   }
   ```
5. Frontend displays as 4 stat cards:
   - ✅ 45 Active / 3 Pending / 48 Total Employees
   - 📍 38 Checked In Today / 40 On Duty
   - 🎟️ 5 Open / 2 In Progress / 1 Urgent Tickets
   - 📋 4 Pending Leave Requests
6. Clicking any card drills down to detail list (e.g. click "4 Pending Leaves" → see all leave requests)

**Activity Feed:**

- Frontend calls: `GET /api/admin/activity`
- Backend returns last 50 activity log entries (newest first)
- Returns:
  ```json
  [
    {
      "type": "check_in",
      "description": "John Doe checked in",
      "time": "2026-03-13T10:15:00Z",
      "actor": "John Doe"
    },
    {
      "type": "registration",
      "description": "New employee registration request from 919876543210",
      "time": "2026-03-13T10:00:00Z",
      "actor": "919876543210"
    },
    ...
  ]
  ```
- Frontend displays as scrolling timeline: icon + description + time

**Activity Types Logged:**
- check_in: guard checked in
- check_out: guard checked out
- registration: new registration request
- leave_request: leave applied
- complaint: client filed ticket
- incident: guard reported incident

**Known Issues:**
- activity_log unbounded → grows forever (add TTL or archival job)
- No filter/search on activity feed (future: search by type/actor/date)

---

### WORKFLOW 23: Approve Guard Registration

**Name:** Admin Approve New Guard  
**Portal:** Admin  
**Page:** `pages/admin-employees.html` → "Pending Registrations" section  
**API Routes:**
- `GET /api/admin/pending-registrations` (list)
- `POST /api/admin/registrations/:id/approve` (approve)
**Status:** Working  
**Purpose:** Admin reviews guard who completed self-registration + OTP verification; approves to activate account

**Steps:**

1. Admin opens admin-portal.html → "Employees" page
2. Sees "Pending Registrations" section with cards for each pending guard
3. Frontend calls: `GET /api/admin/pending-registrations`
4. Backend returns all pending_registrations where verified === true (not yet approved):
   ```json
   [
     {
       "id": "reg_abcd...",
       "name": "John Doe",
       "phone": "919876543210",
       "aadhaar_last4": "4521",
       "applied_at": "2026-03-10T14:30:00Z"
     },
     ...
   ]
   ```
5. Frontend displays each as a card: name | phone | applied date | [Approve] [Reject] buttons
6. Admin clicks "Approve" button
7. Frontend calls: `POST /api/admin/registrations/:id/approve`
8. Backend (atomic transaction):
   - Fetches pending_registrations doc
   - Checks if already approved → 409 "Already approved"
   - Checks if firebase_uid set (OTP verified) → 400 if not
   - Enables Firebase Auth account: `auth.updateUser(firebase_uid, { disabled: false, displayName: ... })`
   - Generates next employee_id: "VAGT-" + auto-incrementing number (via transaction to prevent duplicates)
   - Creates employees Firestore doc:
     ```firestore
     {
       "name": "John Doe",
       "phone": "919876543210",
       "email": "john@example.com",
       "employee_id": "VAGT-0047",
       "status": "active",
       "leave_balance": { "casual": 6, "sick": 4, "earned": 2 },
       "site_ids": [],  // admin assigns sites later
       "joined_at": now
     }
     ```
   - Sets role claim: `auth.setCustomUserClaims(firebase_uid, { role: 'employee' })`
   - Updates pending_registrations: `approved: true, approved_at: now`
   - Logs activity: "Employee VAGT-0047 (919876543210) approved"
   - TODO: Sends SMS with password reset link (not wired)
9. Frontend shows: "Guard approved. Employee ID: VAGT-0047"
10. Guard no longer appears in pending list
11. Guard's account is now enabled; they can log in

**Employee ID Generation:**
- Format: "VAGT-" + 4-digit zero-padded number
- Uses Firestore transaction to atomically increment a counter (prevents duplicates)
- Example: VAGT-0001, VAGT-0002, VAGT-0047, etc.

**Initial Leave Balance:**
- All approved guards start with: casual: 6 days, sick: 4 days, earned: 2 days
- No automatic yearly reset yet (TODO: cron job for FY April 1st)

**Known Issues:**
- Password reset SMS not wired → admin must manually tell guard their email and reset password flow
- No ability to pre-fill guard data (site, basic salary, etc.) during approval
- No bulk approval

---

### WORKFLOW 24: Reject Guard Registration

**Name:** Admin Reject Guard Registration  
**Portal:** Admin  
**Page:** `pages/admin-employees.html` → "Pending Registrations" section  
**API Route:** `POST /api/admin/registrations/:id/reject`  
**Status:** Working  
**Steps:**

1. Admin reviews pending guard and decides to reject
2. Admin clicks "Reject" button on guard's card
3. Optional: admin can add rejection reason in modal
4. Frontend calls: `POST /api/admin/registrations/:id/reject`
   ```json
   { "reason": "Failed background check" }
   ```
5. Backend:
   - Fetches pending_registrations doc
   - If firebase_uid set → deletes disabled Auth account (cleanup)
   - Updates pending_registrations:
     ```firestore
     { "rejected": true, "reject_reason": "Failed background check", "rejected_at": now }
     ```
   - Logs activity: "Registration for 919876543210 rejected"
6. Frontend shows: "Guard registration rejected"
7. Guard no longer appears in pending list; their disabled Auth account is deleted (no ghost accounts)

---

### WORKFLOW 25: Admin Manage Pending Leaves

**Name:** Admin Review & Approve/Reject Leave Requests  
**Portal:** Admin  
**Page:** `pages/admin-portal.html` → "Pending Leaves" section  
**API Routes:**
- `GET /api/admin/pending-leaves` (list all pending)
- `POST /api/admin/leaves/:id/approve` (approve)
- `POST /api/admin/leaves/:id/reject` (reject)
**Status:** Working  
**Steps:**

1. Admin opens admin-portal.html → "Leaves" or pending leaves section
2. Frontend calls: `GET /api/admin/pending-leaves`
3. Backend:
   - Fetches all leave_requests where status === 'pending' (oldest first for FIFO)
   - Uses db.getAll() to batch-fetch all employee docs in ONE round trip (not N+1)
   - Returns:
     ```json
     [
       {
         "id": "leave_abc...",
         "employee_id": "VAGT-0047",
         "employee_name": "John Doe",
         "leave_type": "casual",
         "leave_type_label": "Casual Leave",
         "from_date": "2026-03-20",
         "to_date": "2026-03-22",
         "reason": "Personal emergency",
         "applied_at": "2026-03-13T10:00:00Z"
       },
       ...
     ]
     ```
4. Frontend displays as list: date range | leave type | employee | reason | [Approve] [Reject]
5. Admin clicks "Approve" or "Reject"

**Approve:**

1. Admin clicks "Approve" button
2. Frontend calls: `POST /api/admin/leaves/:id/approve`
3. Backend:
   - Fetches leave_requests doc
   - Fetches employees doc to get current leave_balance
   - Calculates days requested: date diff between from_date and to_date
   - Decrements leave_balance[leave_type] by days requested:
     ```firestore
     employee.leave_balance.casual -= days
     ```
   - Updates leave_requests: `status: 'approved'`
   - Logs activity: "Employee John Doe's leave approved"
   - TODO: Sends SMS to employee (not wired)
4. Frontend shows: "Leave approved"
5. Guard's leave_balance is reduced

**Reject:**

1. Admin clicks "Reject" button
2. Optional: admin can add reason
3. Frontend calls: `POST /api/admin/leaves/:id/reject { reason: "Insufficient balance" }`
4. Backend:
   - Updates leave_requests: `status: 'rejected'`
   - Logs activity: "Employee John Doe's leave rejected"
   - Does NOT decrement leave_balance (reason still shows request exists, but was denied)

**Known Issues:**
- No pre-check for leave balance (admin can accidentally approve more than available)
- No SMS notification to guard
- No escalation if leave is critical/urgent

---

### WORKFLOW 26: Admin Manage Employees

**Name:** Admin View, Activate, Deactivate Employee Accounts  
**Portal:** Admin  
**Page:** `pages/admin-employees.html` (main employees list)  
**API Routes:**
- `GET /api/admin/employees` (list all, optional status filter)
- `GET /api/admin/employees/:id` (detail view)
- `POST /api/admin/employees/:id/deactivate` (suspend account)
- `POST /api/admin/employees/:id/reactivate` (restore account)
**Status:** Working  
**Steps:**

1. Admin opens admin-employees.html
2. Optional: filter by status (active/inactive)
3. Frontend calls: `GET /api/admin/employees?status=active`
4. Backend returns list (limit 500):
   ```json
   [
     {
       "id": "<firebase_uid>",
       "employee_id": "VAGT-0047",
       "name": "John Doe",
       "phone": "919876543210",
       "email": "john@example.com",
       "site_name": "Acme HQ",
       "status": "active",
       "joined_at": "2026-03-10T14:30:00Z"
     },
     ...
   ]
   ```
5. Frontend displays as table: ID | Name | Site | Status | Actions
6. Admin clicks employee name → see detail:
   - `GET /api/admin/employees/:id`
   - Returns:
     ```json
     {
       "id": "<uid>",
       "employee_id": "VAGT-0047",
       "name": "John Doe",
       "phone": "919876543210",
       "email": "john@example.com",
       "site_name": "Acme HQ",
       "status": "active",
       "joined_at": "2026-03-10...",
       "aadhaar_last4": "4521",
       "address": "...",
       "emergency_contact": "...",
       "leave_balance": { "casual": 5, "sick": 3, "earned": 2 },
       "attendance_rate": 92.5
     }
     ```
7. Frontend shows full details + [Deactivate] [Generate Keycode] [View Incidents] buttons

**Deactivate:**

1. Admin clicks "Deactivate" button
2. Frontend calls: `POST /api/admin/employees/:id/deactivate`
3. Backend:
   - Updates employees doc: `status: 'inactive'`
   - Disables Firebase Auth account: `auth.updateUser(id, { disabled: true })`
   - Logs activity: "Employee John Doe deactivated"
4. Guard can NO LONGER log in (Auth account disabled)
5. Frontend shows: "Employee deactivated"

**Reactivate:**

1. Admin clicks "Reactivate" button (on inactive employee)
2. Frontend calls: `POST /api/admin/employees/:id/reactivate`
3. Backend:
   - Updates employees doc: `status: 'active'`
   - Re-enables Firebase Auth account: `auth.updateUser(id, { disabled: false })`
   - Logs activity: "Employee John Doe reactivated"
4. Guard can log in again

---

### WORKFLOW 27: Admin Generate Guard Keycode

**Name:** Admin Issue Physical Keycode Card to Guard  
**Portal:** Admin  
**Page:** `pages/admin-employees.html` (employee detail view)  
**API Route:** `POST /api/admin/employees/:id/generate-keycode`  
**Status:** Working  
**Purpose:** Admin generates XXXX-XXXX keycode for guard to use without password on shared device

**Steps:**

1. Admin opens employee detail view (workflow 26)
2. Admin clicks "Generate Keycode" button
3. Frontend calls: `POST /api/admin/employees/:id/generate-keycode`
4. Backend:
   - Fetches employee doc to get employee_id, name
   - Generates keycode: 4 + dash + 4 = XXXX-XXXX format using unambiguous chars only (no 0, O, I, 1)
   - Checks if employee already has an active keycode:
     - If yes → soft-revokes old one: `active: false`
   - Stores new keycode in guard_keycodes collection:
     ```firestore
     {
       "keycode": "ABCD-1234",  // doc ID is the keycode
       "employee_uid": "<uid>",
       "employee_id": "VAGT-0047",
       "name": "John Doe",
       "issued_at": now,
       "active": true,
       "last_used_at": null
     }
     ```
   - Logs activity: "Keycode ABCD-1234 issued to John Doe"
   - Returns: `{ "keycode": "ABCD-1234" }`
5. Frontend shows modal: "Keycode Generated: ABCD-1234"
   - Admin can print, copy, or screenshot
   - Admin physically gives card (or printed slip) to guard
6. Guard can now log in via keycode on any shared device (no password needed, no personal phone required)

**Keycode Format:**
- 4 uppercase letters + dash + 4 unambiguous chars
- Characters: A-Z (no O or I), 2-9 (no 0 or 1)
- Examples: ABCD-2345, XYZW-9876
- One per guard; issuing new one auto-revokes old one
- Stored as doc ID in guard_keycodes collection for fast lookup

**Revoke Keycode:**

- `POST /api/admin/employees/:id/revoke-keycode`
- Sets active: false on the current keycode doc
- Guard can no longer use that keycode

---

### WORKFLOW 28: Admin Manage Schedule (Shifts)

**Name:** Admin Create/View/Delete Guard Shifts  
**Portal:** Admin  
**Page:** `pages/admin-schedule.html` (when re-enabled)  
**API Routes:**
- `GET /api/admin/schedule` (list shifts for date range)
- `POST /api/admin/schedule` (create shift)
- `DELETE /api/admin/schedule/:id` (delete shift)
**Status:** ⚠️ Built (backend works) but Disabled (frontend page hidden)  
**Purpose:** Admin creates shift assignments (employee + site + date + shift type)

**Steps:**

1. Admin opens admin-schedule.html (currently disabled)
2. Shows calendar view or list of upcoming shifts
3. Frontend calls: `GET /api/admin/schedule` (with optional week_start param)
4. Backend returns shifts for next 100 days:
   ```json
   [
     {
       "id": "<shift_id>",
       "employee_id": "VAGT-0047",
       "employee_name": "John Doe",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "date": "2026-03-15",
       "shift_type": "morning",
       "start_time": "06:00",
       "end_time": "14:00"
     },
     ...
   ]
   ```
5. Frontend displays as calendar: dates across columns, employees down rows, cells show shift assignment

**Create Shift:**

1. Admin clicks "Add Shift" or right-clicks calendar cell
2. Modal opens: select employee (dropdown) + site + date + shift type
3. Admin submits
4. Frontend calls: `POST /api/admin/schedule`
   ```json
   {
     "employee_id": "<firebase_uid>",
     "site_id": "site_123",
     "date": "2026-03-15",
     "shift_type": "morning"
   }
   ```
5. Backend:
   - Validates inputs
   - Prevents double-booking: one employee, one shift per date
   - Fetches employee + site docs (for denormalization)
   - Looks up shift times from predefined map:
     - morning: 06:00–14:00
     - afternoon: 14:00–22:00
     - night: 22:00–06:00
   - Creates shifts document:
     ```firestore
     {
       "employee_uid": "<uid>",
       "employee_id": "VAGT-0047",
       "employee_name": "John Doe",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "date": "2026-03-15",
       "shift_type": "morning",
       "start_time": "06:00",
       "end_time": "14:00",
       "created_at": now
     }
     ```
   - Logs activity: "Shift assigned: John Doe at Acme HQ on 2026-03-15"
6. Frontend shows: "Shift created"
7. Shift appears on calendar

**Delete Shift:**

1. Admin clicks on shift → sees [Delete] button
2. Frontend calls: `DELETE /api/admin/schedule/:id`
3. Backend deletes shift doc
4. Shift removed from calendar

**Shift Times (Fixed):**
- Morning: 06:00 AM – 02:00 PM
- Afternoon: 02:00 PM – 10:00 PM
- Night: 10:00 PM – 06:00 AM

---

### WORKFLOW 29: Admin Manage Clients

**Name:** Admin View & Manage Client Accounts  
**Portal:** Admin  
**Page:** `pages/admin-clients.html` (when re-enabled)  
**API Routes:**
- `GET /api/admin/clients` (list all)
- `GET /api/admin/clients/:id` (detail with sites + open tickets)
**Status:** ⚠️ Built but Disabled  
**Purpose:** Admin can view all client records, their sites, and open tickets

**Steps:**

1. Admin opens admin-clients.html (currently disabled)
2. Frontend calls: `GET /api/admin/clients`
3. Backend returns list (limit 500):
   ```json
   [
     {
       "id": "<client_uid>",
       "name": "Acme Corp",
       "contact_name": "Sarah Miller",
       "contact_email": "sarah@acme.com",
       "contact_phone": "919876543210",
       "sites_count": 3,
       "contract_start": "2025-01-15",
       "sla_response_hours": 4,
       "status": "active"
     },
     ...
   ]
   ```
4. Frontend displays as list: name | contact | sites | SLA | status
5. Admin clicks client → detail view:
   - `GET /api/admin/clients/:id`
   - Returns client doc + list of all their sites + count of open tickets:
     ```json
     {
       "id": "<uid>",
       "name": "Acme Corp",
       "contact_name": "Sarah Miller",
       "contact_email": "sarah@acme.com",
       "contact_phone": "919876543210",
       "sites_count": 3,
       "contract_start": "2025-01-15",
       "sla_response_hours": 4,
       "status": "active",
       "sites": [
         { "id": "site_123", "name": "Acme HQ", "address": "Downtown", "guards_deployed": 5 },
         { "id": "site_456", "name": "Tech Park", "address": "North", "guards_deployed": 3 }
       ],
       "open_tickets": 2,
       "notes": "VIP account — priority SLA"
     }
     ```
6. Admin can see client's contracts, sites, active tickets

---

### WORKFLOW 30: Admin Manage Sites

**Name:** Admin View & Manage Site Records  
**Portal:** Admin  
**Page:** `pages/admin-sites.html` (when re-enabled)  
**API Routes:**
- `GET /api/admin/sites` (list all)
- `GET /api/admin/sites/:id` (detail with guards on shift today)
**Status:** ⚠️ Built but Disabled  
**Purpose:** Admin can view all client sites, coverage, and today's active guards

**Steps:**

1. Admin opens admin-sites.html (currently disabled)
2. Frontend calls: `GET /api/admin/sites`
3. Backend returns list (limit 500):
   ```json
   [
     {
       "id": "site_123",
       "name": "Acme HQ",
       "client_id": "<client_uid>",
       "client_name": "Acme Corp",
       "address": "Downtown Plaza, 5th Floor",
       "posts_required": 2,
       "guards_deployed": 5,
       "coverage_status": "full"
     },
     ...
   ]
     ```
4. Admin clicks site → detail:
   - `GET /api/admin/sites/:id`
   - Returns site doc + all guards assigned + today's active shifts:
     ```json
     {
       "id": "site_123",
       "name": "Acme HQ",
       "client_id": "<uid>",
       "client_name": "Acme Corp",
       "address": "Downtown Plaza, 5th Floor",
       "posts_required": 2,
       "guards_deployed": 5,
       "coverage_status": "full",
       "assigned_guards": [
         { "id": "emp_uid", "name": "John Doe", "status": "active" },
         ...
       ],
       "today_shifts": [
         { "id": "shift_id", "name": "John Doe", "shift_type": "morning", "start_time": "06:00" },
         { "id": "shift_id", "name": "Sarah Khan", "shift_type": "afternoon", "start_time": "14:00" }
       ]
     }
     ```
5. Admin sees: who's assigned + who's on duty today

---

### WORKFLOW 31: Admin View Complaints & Update Status

**Name:** Admin Review Client Complaints  
**Portal:** Admin  
**Page:** `pages/admin-complaints.html`  
**API Routes:**
- `GET /api/admin/complaints` (list all)
- `GET /api/admin/complaints/:id` (detail)
- `POST /api/admin/complaints/:id/status` (update status + add note)
**Status:** Working  
**Steps:**

1. Admin opens admin-complaints.html
2. Frontend calls: `GET /api/admin/complaints`
3. Backend returns all complaints (limit 500), with optional status filter:
   ```json
   [
     {
       "id": "<complaint_id>",
       "ticket_id": "TKT-2026-AB4F9E",
       "client_name": "Acme Corp",
       "type": "complaint",
       "priority": "high",
       "subject": "Guard no-show at north gate",
       "status": "open",
       "created_at": "2026-03-13T14:00:00Z"
     },
     ...
   ]
   ```
4. Frontend displays as list: ticket # | client | type | subject | priority (color-coded) | status
5. Admin clicks complaint → detail:
   - `GET /api/admin/complaints/:id`
   - Returns full complaint + admin note field:
     ```json
     {
       "id": "<id>",
       "ticket_id": "TKT-2026-AB4F9E",
       "client_uid": "<uid>",
       "client_name": "Acme Corp",
       "type": "complaint",
       "priority": "high",
       "subject": "Guard no-show at north gate",
       "description": "Expected guard at 2 PM... Had to cover manually...",
       "status": "open",
       "created_at": "2026-03-13T14:00:00Z",
       "admin_note": null
     }
     ```
6. Admin reviews → clicks [Mark In Progress] or [Resolve] + optionally adds a note
7. Frontend calls: `POST /api/admin/complaints/:id/status`
   ```json
   {
     "status": "in_progress",
     "admin_note": "Spoke to guard supervisor. Guard was sick. Replacement deployed same day."
   }
   ```
8. Backend:
   - Updates complaints doc:
     ```firestore
     { "status": "in_progress", "admin_note": "...", "updated_at": now }
     ```
   - Logs activity: "Complaint TKT-2026-AB4F9E marked in_progress"
9. Frontend shows: "Status updated"
10. Next time client checks GET /api/complaints, they see updated status + admin note

**Statuses:**
- open: just filed
- in_progress: admin investigating
- resolved: issue addressed

**Known Issues:**
- No SLA tracking (e.g. "respond within 4 hours")
- Admin note visible to client (transparency good, but consider masking sensitive notes)

---

### WORKFLOW 32: Admin View Payroll & Generate Payslips

**Name:** Admin Run Payroll & Generate Monthly Payslips  
**Portal:** Admin  
**Page:** `pages/admin-payroll.html` (currently disabled)  
**API Routes:**
- `GET /api/admin/payroll` (overview for a month)
- `POST /api/admin/payroll/run` (generate all payslips for a month)
- `POST /api/admin/payroll/:employee_id/generate-slip` (regenerate one slip)
**Status:** ⚠️ Built but Disabled & Placeholder (payroll calculation not production-ready)  
**Purpose:** Admin runs monthly payroll, generates payslips for all employees

**Important Warning:**

Current payroll calculation is a PLACEHOLDER:
```
gross = basic_salary
deductions = gross * 0.02  (flat 2%)
net = gross - deductions
```

This is NOT LEGAL for India. Before go-live, must implement:
- EPF: 12% employee + 12% employer (on basic, capped ₹15k basic)
- ESI: 0.75% employee + 3.25% employer (if gross ≤ ₹21k)
- TDS (if applicable)
- Attendance-based proration (from attendance_logs)
- HRA, allowances from employee profile

**Steps:**

1. Admin opens admin-payroll.html (currently hidden)
2. Admin selects month (e.g. "March 2026")
3. Frontend calls: `GET /api/admin/payroll?month=2026-03`
4. Backend returns payroll overview for all active employees:
   ```json
   {
     "month": "2026-03",
     "total_employees": 45,
     "payslips_generated": 42,
     "pending": 3,
     "total_gross": 1089000,
     "total_net": 1067220
   }
   ```
5. Frontend shows: "42 / 45 payslips generated"
6. Admin clicks "Generate Missing Payslips" or "Run Payroll"
7. Frontend calls: `POST /api/admin/payroll/run`
   ```json
   { "month": "2026-03" }
   ```
8. Backend:
   - Fetches all active employees
   - For each employee:
     - Calculates gross = basic_salary (from employee doc)
     - Calculates deductions = gross * 0.02 (PLACEHOLDER)
     - Calculates net = gross - deductions
     - Creates payslips document:
       ```firestore
       {
         "employee_uid": "<uid>",
         "employee_id": "VAGT-0047",
         "employee_name": "John Doe",
         "period": "2026-03",
         "basic": 15000,
         "allowances": 0,
         "gross_pay": 15000,
         "deductions": 300,
         "net_pay": 14700,
         "generated_at": now,
         "pdf_path": null  // will be filled on first download
       }
       ```
     - Logs activity: "Payroll run for March 2026 completed. 45 payslips generated."
   - Returns count of generated payslips
9. Frontend shows: "Payroll generated"
10. Admin can view each employee's payslip → guard can download PDF

**Regenerate One Slip:**

- `POST /api/admin/payroll/:employee_id/generate-slip`
- Regenerates payslip for one employee (e.g. if calculation was wrong)
- Overwrites existing payslip doc + clears pdf_path (forces PDF rebuild on next download)

---

### WORKFLOW 33: Admin View Patrol Logs & Manage Checkpoints

**Name:** Admin Review Beat Patrol Coverage & Register NFC Checkpoints  
**Portal:** Admin  
**Page:** `pages/admin-patrol.html`  
**API Routes:**
- `GET /api/admin/patrol/logs` (filterable by site/date/guard)
- `GET /api/admin/patrol/checkpoints` (all checkpoints with QR codes)
- `POST /api/admin/patrol/checkpoints` (register new checkpoint)
- `DELETE /api/admin/patrol/checkpoints/:id` (deactivate checkpoint)
**Status:** Working  
**Steps (View Logs):**

1. Admin opens admin-patrol.html
2. Optional: select filters: site, date, guard
3. Frontend calls: `GET /api/admin/patrol/logs?site=site_123&date=2026-03-13&guard=<uid>`
4. Backend returns all patrol scans for that day/site/guard:
   ```json
   [
     {
       "id": "<log_id>",
       "guard_name": "John Doe",
       "checkpoint_label": "North Gate",
       "site_name": "Acme HQ",
       "scan_method": "nfc",
       "scanned_at": "2026-03-13T06:30:00Z"
     },
     ...
   ]
   ```
5. Frontend displays timeline: time | guard | checkpoint | method

**Steps (Manage Checkpoints):**

1. Admin clicks "Checkpoints" tab
2. Frontend calls: `GET /api/admin/patrol/checkpoints?site=site_123`
3. Backend returns all checkpoints (all sites if no filter):
   - For each checkpoint, generates QR code data URL (for printing labels)
   ```json
   [
     {
       "id": "checkpoint_123",
       "label": "North Gate",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "nfc_tag_id": "NFC:ABC123",
       "active": true,
       "qr_data_url": "data:image/png;base64,..."
     },
     ...
   ]
   ```
4. Frontend displays as list: label | site | tag ID | status | [QR Print] [Delete]
5. Admin clicks [QR Print] → opens QR code in modal → print physical label for wall

**Register New Checkpoint:**

1. Admin clicks "Add Checkpoint"
2. Modal opens: label (required), NFC tag ID (required), site (optional)
3. Admin enters: "North Gate" | "NFC:ABC123" | "Acme HQ"
4. Admin submits
5. Frontend calls: `POST /api/admin/patrol/checkpoints`
   ```json
   {
     "label": "North Gate",
     "nfc_tag_id": "NFC:ABC123",
     "site_id": "site_123",
     "site_name": "Acme HQ"
   }
   ```
6. Backend:
   - Validates NFC tag ID is not already in use (prevents duplicates)
   - Creates patrol_checkpoints doc:
     ```firestore
     {
       "label": "North Gate",
       "nfc_tag_id": "NFC:ABC123",
       "site_id": "site_123",
       "site_name": "Acme HQ",
       "active": true,
       "created_at": now
     }
     ```
   - Logs activity: "Checkpoint 'North Gate' registered at Acme HQ"
7. Frontend shows: "Checkpoint registered. Print the QR code and mount on wall."

**Deactivate Checkpoint:**

1. Admin clicks [Delete] button on checkpoint
2. Frontend calls: `DELETE /api/admin/patrol/checkpoints/:id`
3. Backend soft-deletes: `active: false`
   - Preserves all historical patrol_logs (audit trail)
4. Checkpoint no longer appears in guard's list or on client view

**Known Issues:**
- Physical NFC tags not yet arrived (hardware dependency)
- No validation that tag ID is actually an NFC tag (could be arbitrary string)
- No map view of checkpoint locations

---

### WORKFLOW 34: Admin View Sign-In Events (Audit Log)

**Name:** Admin Review Keycode Sign-In Audit Trail  
**Portal:** Admin  
**Page:** `pages/admin-portal.html` → "Sign-In Events" tab (in employees section)  
**API Route:** `GET /api/admin/sign-in-events`  
**Status:** Working  
**Purpose:** Admin can audit all keycode logins (who, when, where via GPS, device info)

**Steps:**

1. Admin opens sign-in events view
2. Frontend calls: `GET /api/admin/sign-in-events`
3. Backend returns all sign-in attempts (last 500):
   ```json
   [
     {
       "id": "<event_id>",
       "employee_id": "VAGT-0047",
       "name": "John Doe",
       "keycode": "ABCD-1234",
       "latitude": 12.9716,
       "longitude": 77.5946,
       "geo_accuracy": 45.2,
       "device_info": "Mozilla/5.0... Samsung Galaxy",
       "ip_address": "203.0.113.45",
       "timestamp": "2026-03-13T10:15:00Z"
     },
     ...
   ]
   ```
4. Frontend displays as table: name | time | location | device | IP

**Data Captured:**
- Guard's employee ID + name
- Keycode used (format: XXXX-XXXX)
- GPS coordinates (latitude, longitude) + accuracy in meters
- Device info (browser + OS user agent)
- IP address
- Timestamp (when sign-in was processed)

**Use Cases:**
- Verify guard was at correct location at correct time
- Investigate unauthorized logins (wrong device, wrong location)
- Audit trail for compliance/disputes

**Known Issues:**
- Not all devices support geolocation (iOS apps, some browsers)
- IP address only as accurate as ISP geolocation

---

## SUMMARY MATRIX

### Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Working | Feature built, tested, used in production |
| ⚠️ Built but Untested | Code exists, not yet validated end-to-end |
| 🚫 Disabled | Code built, UI hidden (pages show "Temporarily Disabled") |
| ❌ Not Built | Not implemented (roadmap only) |
| 🔴 Blocked | Implementation blocked by dependencies (e.g. SMS) |

### Workflow Completion Status

| # | Workflow | Portal | Status | Blocker |
|---|----------|--------|--------|---------|
| 1 | Browse Public Website | Public | ✅ | — |
| 2 | Employee Email Login | Employee | ✅ | — |
| 3 | Employee Keycode Login | Employee | ✅ | Physical NFC cards |
| 4 | Client/Admin Login | Client/Admin | ✅ | Admin role claim not set |
| 5 | Employee Self-Registration | Public | ⚠️ | SMS not wired |
| 6 | Password Reset | Employee | ⚠️ | SMS not wired |
| 7 | Check-In | Employee | ✅ | — |
| 8 | Check-Out | Employee | ✅ | — |
| 9 | Attendance History | Employee | ⚠️ | Only today's available |
| 10 | Leave Request & Approval | Employee/Admin | ✅ | No SMS on approval |
| 11 | View Payslips | Employee | ✅ | PDF generation placeholder |
| 12 | View Schedule | Employee | ✅ | Composite index missing |
| 13 | View Assigned Sites | Employee | ⚠️ | Guards not assigned sites |
| 14 | File Incident Report | Employee | ✅ | No SMS for critical |
| 15 | Guest Entry & Exit | Employee | ✅ | — |
| 16 | Beat Patrol (NFC/QR) | Employee | ✅ | No physical tags yet |
| 17 | Client Complaint | Client | ✅ | No email/SMS notify |
| 18 | Client Deployment Summary | Client | ⚠️ | Guard count manual |
| 19 | Client View Invoices | Client | ✅ | PDFs manual upload |
| 20 | Client View Reports | Client | ✅ | No structured data |
| 21 | Client View Patrol | Client | ✅ | — |
| 22 | Client View Visitors | Client | ✅ | — |
| 23 | Admin Dashboard | Admin | ✅ | No analytics |
| 24 | Approve Guard | Admin | ✅ | No password SMS |
| 25 | Reject Guard | Admin | ✅ | — |
| 26 | Manage Leaves | Admin | ✅ | — |
| 27 | Manage Employees | Admin | ✅ | — |
| 28 | Generate Keycode | Admin | ✅ | — |
| 29 | Manage Schedule | Admin | 🚫 | Page disabled |
| 30 | Manage Clients | Admin | 🚫 | Page disabled |
| 31 | Manage Sites | Admin | 🚫 | Page disabled |
| 32 | Manage Complaints | Admin | ✅ | — |
| 33 | View Payroll | Admin | 🚫 | Calculation placeholder |
| 34 | Manage Patrol | Admin | ✅ | No physical tags |
| 35 | Sign-In Audit | Admin | ✅ | — |

---

## CRITICAL ISSUES SUMMARY

### Blocking Production Use

1. **Admin role claim not set** (URGENT)
   - Admin account exists but has no `role: 'admin'` custom claim
   - Admin portal inaccessible (403 Forbidden on all routes)
   - Fix: Run `node set-admin-claim.js` from Mac OR manually via Firebase Console

2. **SMS/OTP not wired** (P1 — blocks core flows)
   - Guards cannot self-register (OTP never arrives)
   - Guards cannot reset password (OTP never arrives)
   - Admin cannot send password reset link on approval (SMS not sent)
   - Incident critical alerts not sent to duty manager
   - Fix: Integrate MSG91 API (see auth.js TODO comments for exact code)

3. **Security headers not deployed** (P2)
   - CSP/XFO headers defined in code but Firebase Hosting ignores them
   - Must be added to `firebase.json` file
   - Fix: Update firebase.json + redeploy

### Known Technical Debt

- Payroll calculation is placeholder (2% flat deduction — not legal in India)
- activity_log unbounded (will grow forever, slow over time)
- No composite Firestore indexes for several filtered queries
- No input validation library (manual checks only; may have gaps)
- Denormalized employee/site names — no cleanup on updates
- English-only UI (guards struggle — need Hindi + Kannada)
- No Google Analytics installed (zero visibility on platform usage)
- Contact form not wired (submissions go nowhere)

---

**End of Comprehensive Workflow Reference**

All workflows mapped, documented with API routes, status, and known issues. Ready for development, testing, and deployment.