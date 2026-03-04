# VAGT Platform — Backend API Contract

> **For the backend developer.**
> Every endpoint consumed by the frontend is documented here with request shape, response shape, auth requirements, and error codes.
> Base URL: `https://api.vagtsecurityservices.com`
> All requests/responses use `Content-Type: application/json` unless noted.

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

Tokens are stored in the client browser's `localStorage`. Key names:
- Employee: `vagt_emp_token`, `vagt_emp_user`
- Client:   `vagt_client_token`, `vagt_client_user`
- Admin:    `vagt_admin_token`, `vagt_admin_user`

On any `401` response the frontend automatically clears tokens and redirects to the login page. **Do not return 401 for any other reason.**

### Token Payload (JWT)
```json
{
  "sub": "user_id",
  "role": "employee | client | admin",
  "name": "Full Name",
  "employee_id": "VAGT-0042",   // employees only
  "company_name": "EY India",   // clients only
  "exp": 1234567890
}
```

### Standard Error Response
```json
{ "message": "Human-readable error message." }
```

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Unified login for all roles.
```json
// Request
{ "identifier": "email or employee_id", "password": "string" }

// Response — single role
{ "token": "jwt", "roles": ["employee"], "user": { "id": "...", "name": "...", "role": "employee" } }

// Response — multiple roles
{ "token": "jwt", "roles": ["employee", "admin"], "user": { "id": "...", "name": "..." } }
```

### `POST /api/auth/forgot-password`
```json
// Request
{ "identifier": "email or employee_id" }

// Response
{ "reset_token": "opaque_token", "message": "OTP sent to registered phone/email." }
```

### `POST /api/auth/reset-password`
```json
// Request
{ "reset_token": "string", "otp": "string", "new_password": "string" }

// Response
{ "success": true }
```

### `POST /api/auth/resend-reset-otp`
```json
// Request
{ "reset_token": "string" }
// Response
{ "message": "OTP resent." }
```

---

## 2. Employee Self-Registration

### `POST /api/auth/employee/register`
```json
// Request
{ "phone": "+91XXXXXXXXXX", "email": "email@example.com", "password": "string" }

// Response
{ "registration_token": "opaque_token" }
// Side effect: sends OTP to phone
```

### `POST /api/auth/employee/verify-otp`
```json
// Request
{ "registration_token": "string", "otp": "string" }
// Response
{ "success": true }
// Side effect: creates pending registration, notifies admin
```

### `POST /api/auth/employee/resend-otp`
```json
// Request
{ "registration_token": "string" }
// Response
{ "message": "OTP resent." }
```

### `POST /api/auth/employee/login`
```json
// Request
{ "employee_id": "VAGT-0042", "password": "string" }
// Response
{ "token": "jwt", "user": { "id": "...", "employee_id": "...", "name": "..." } }
```

### `POST /api/auth/client/login`
```json
// Request
{ "email": "client@company.com", "password": "string" }
// Response
{ "token": "jwt", "client": { "id": "...", "name": "...", "company_name": "..." } }
```

---

## 3. Employee Portal

All require `Authorization: Bearer <vagt_emp_token>`.

### `GET /api/attendance/today`
```json
// Response
{ "checked_in": true, "time": "2026-03-04T08:32:00Z", "site": "EY Tower, Whitefield" }
```

### `POST /api/attendance/checkin`
```json
// Response
{ "success": true, "time": "2026-03-04T08:32:00Z" }
```

### `POST /api/attendance/checkout`
```json
// Response
{ "success": true, "time": "2026-03-04T17:05:00Z" }
```

### `GET /api/leave/balance`
```json
// Response
{
  "balance_days": 12,
  "leave_types": [
    { "type": "casual", "label": "Casual Leave", "balance": 6 },
    { "type": "sick",   "label": "Sick Leave",   "balance": 4 },
    { "type": "earned", "label": "Earned Leave",  "balance": 2 }
  ]
}
```

### `GET /api/leave/history`
```json
// Response — array
[{
  "id": "lv_001",
  "leave_type": "casual",
  "leave_type_label": "Casual Leave",
  "from_date": "2026-02-10",
  "to_date": "2026-02-12",
  "reason": "Personal work",
  "status": "approved | pending | rejected",
  "applied_at": "ISO 8601"
}]
```

### `POST /api/leave/apply`
```json
// Request
{ "leave_type": "casual", "from_date": "YYYY-MM-DD", "to_date": "YYYY-MM-DD", "reason": "string" }
// Response
{ "id": "lv_002", "status": "pending" }
```

### `GET /api/payslips`
```json
// Response — array, newest first
[{
  "id": "slip_001",
  "month": 2,
  "year": 2026,
  "month_label": "February 2026",
  "net_pay": 18500,
  "url": "https://api.vagtsecurityservices.com/payslips/slip_001.pdf"
}]
```

### `GET /api/employee/schedule?week_start=YYYY-MM-DD`
```json
// Response — array
[{
  "id": "shift_001",
  "date": "2026-03-04",
  "site_name": "EY Tower, Whitefield",
  "site_address": "Whitefield Main Road, Bengaluru",
  "shift_type": "morning | afternoon | night",
  "start_time": "06:00",
  "end_time": "14:00"
}]
```

### `GET /api/employee/sites`
Sites the employee is deployed to (for incident report dropdown).
```json
// Response
[{ "id": "site_001", "name": "EY Tower, Whitefield" }]
```

### `GET /api/employee/incidents`
```json
// Response
[{
  "id": "inc_001",
  "reference_number": "INC-2026-0042",
  "type": "trespassing",
  "type_label": "Trespassing / Unauthorised Entry",
  "severity": "medium",
  "site_name": "EY Tower",
  "occurred_at": "ISO 8601",
  "status": "submitted | acknowledged | resolved",
  "submitted_at": "ISO 8601"
}]
```

### `POST /api/employee/incidents`
```json
// Request
{
  "type": "trespassing",
  "severity": "medium",
  "site_id": "site_001",
  "occurred_at": "2026-03-04T14:30",
  "description": "string (required)",
  "persons_involved": "string (optional)",
  "action_taken": "string (optional)"
}
// Response
{ "id": "inc_001", "reference_number": "INC-2026-0042", "status": "submitted" }
// Side effect: notify admin immediately if severity is high or critical
```

---

## 4. Client Portal

All require `Authorization: Bearer <vagt_client_token>`.

### `POST /api/complaints`
```json
// Request
{ "type": "complaint | service_request | feedback | emergency", "priority": "low | medium | high | urgent", "subject": "string", "description": "string" }
// Response
{ "id": "cmp_001", "status": "open", "created_at": "ISO 8601" }
```

### `GET /api/complaints`
```json
// Response
[{
  "id": "cmp_001",
  "type": "complaint",
  "priority": "high",
  "subject": "Guard absent on Tuesday",
  "status": "open | in_progress | resolved | closed",
  "created_at": "ISO 8601"
}]
```

### `GET /api/client/deployment-summary`
```json
// Response
{
  "guards_on_duty": 4,
  "sites_covered": 2,
  "incidents_this_month": 1,
  "open_tickets": 2
}
```

### `GET /api/client/sites`
```json
// Response
[{ "id": "site_001", "name": "EY Tower, Whitefield" }]
```

### `GET /api/client/reports?site=&type=&month=YYYY-MM`
```json
// Response
[{
  "id": "rpt_001",
  "date": "2026-03-04",
  "site_id": "site_001",
  "site_name": "EY Tower",
  "report_type": "daily_log | incident | inspection",
  "guard_name": "Rajan Kumar",
  "summary": "Uneventful shift. 2 visitor passes issued.",
  "details": "Full text of the report (optional long form)"
}]
```

### `GET /api/client/invoices/summary`
```json
// Response
{
  "outstanding_amount": 48000,
  "overdue_amount": 0,
  "paid_ytd": 240000,
  "total_invoices": 14,
  "fiscal_year_label": "FY 2025–26"
}
```

### `GET /api/client/invoices`
```json
// Response
[{
  "id": "inv_001",
  "invoice_number": "VAGT-INV-2026-014",
  "period_label": "February 2026",
  "issued_date": "2026-03-01",
  "due_date": "2026-03-15",
  "amount": 48000,
  "status": "paid | unpaid | overdue | partial",
  "paid_amount": null,
  "pdf_url": "https://api.vagtsecurityservices.com/invoices/inv_001.pdf"
}]
```

---

## 5. Admin Portal

All require `Authorization: Bearer <vagt_admin_token>` and role `admin`.

### `GET /api/admin/overview`
```json
// Response
{
  "employees": { "active": 87, "pending_approval": 3, "total": 90 },
  "attendance": { "checked_in": 62, "total_on_duty": 80 },
  "tickets":    { "open": 5, "in_progress": 2, "urgent": 1 },
  "leaves":     { "pending": 4 }
}
```

### `GET /api/admin/activity`
```json
// Response — most recent first, max 50
[{
  "type": "check_in | check_out | leave_request | complaint | registration | other",
  "description": "Rajan Kumar checked in at EY Tower",
  "time": "ISO 8601",
  "actor": "Rajan Kumar"
}]
```

### `GET /api/admin/pending-registrations`
```json
// Response
[{
  "id": "reg_001",
  "name": "Suresh Babu",
  "phone": "+91 99001 23456",
  "aadhaar_last4": "7890",
  "applied_at": "ISO 8601"
}]
```

### `POST /api/admin/registrations/:id/approve`
```json
// Response
{ "success": true }
// Side effect: create employee account, send credentials via SMS
```

### `POST /api/admin/registrations/:id/reject`
```json
// Request (optional)
{ "reason": "string" }
// Response
{ "success": true }
```

### `GET /api/admin/pending-leaves`
```json
// Response
[{
  "id": "lv_001",
  "employee_id": "VAGT-0042",
  "employee_name": "Rajan Kumar",
  "leave_type": "casual",
  "leave_type_label": "Casual Leave",
  "from_date": "2026-03-10",
  "to_date": "2026-03-12",
  "reason": "Family function",
  "applied_at": "ISO 8601"
}]
```

### `POST /api/admin/leaves/:id/approve`
### `POST /api/admin/leaves/:id/reject`
```json
// Response
{ "success": true }
// Side effect: notify employee via push/SMS
```

### `GET /api/admin/employees?status=active|pending|inactive`
```json
// Response
[{
  "id": "emp_001",
  "employee_id": "VAGT-0042",
  "name": "Rajan Kumar",
  "phone": "+91 99001 23456",
  "email": "rajan@example.com",
  "site_name": "EY Tower",
  "status": "active | pending | inactive",
  "joined_at": "ISO 8601"
}]
```

### `GET /api/admin/employees/:id`
Same as above plus:
```json
{
  "aadhaar_last4": "7890",
  "address": "string",
  "emergency_contact": "string",
  "leave_balance": { "casual": 6, "sick": 4, "earned": 2 },
  "attendance_rate": 94.5
}
```

### `POST /api/admin/employees/:id/deactivate`
### `POST /api/admin/employees/:id/reactivate`
```json
// Response
{ "success": true }
```

---

## 6. Admin — Schedule

### `GET /api/admin/schedule?week_start=YYYY-MM-DD`
```json
// Response
[{
  "id": "shift_001",
  "employee_id": "emp_001",
  "employee_name": "Rajan Kumar",
  "site_id": "site_001",
  "site_name": "EY Tower",
  "date": "2026-03-04",
  "shift_type": "morning | afternoon | night",
  "start_time": "06:00",
  "end_time": "14:00"
}]
```

### `POST /api/admin/schedule`
```json
// Request
{ "employee_id": "emp_001", "site_id": "site_001", "date": "YYYY-MM-DD", "shift_type": "morning" }
// Response
{ "id": "shift_002", ...full shift object }
// Validation: reject if employee already has a shift on that date
```

### `DELETE /api/admin/schedule/:id`
```json
// Response
{ "success": true }
```

---

## 7. Admin — Clients & Sites

### `GET /api/admin/clients`
```json
[{
  "id": "client_001",
  "name": "EY India",
  "contact_name": "Priya Mehta",
  "contact_email": "priya@ey.com",
  "contact_phone": "+91 80001 23456",
  "sites_count": 2,
  "contract_start": "2022-01-01",
  "sla_response_hours": 2,
  "status": "active | inactive | prospect"
}]
```

### `GET /api/admin/clients/:id`
Same as above plus:
```json
{
  "sites": [{ "id": "site_001", "name": "EY Tower", "address": "...", "guards_deployed": 4 }],
  "open_tickets": 2,
  "notes": "string"
}
```

### `GET /api/admin/sites`
```json
[{
  "id": "site_001",
  "name": "EY Tower, Whitefield",
  "client_id": "client_001",
  "client_name": "EY India",
  "address": "Whitefield Main Road, Bengaluru 560066",
  "posts_required": 4,
  "guards_deployed": 3,
  "coverage_status": "full | partial | none"
}]
```

### `GET /api/admin/sites/:id`
Same as above plus:
```json
{
  "site_contact_name": "Anil Sharma",
  "site_contact_phone": "+91 98001 23456",
  "notes": "string",
  "active_guards": [{ "id": "emp_001", "name": "Rajan Kumar", "shift_type": "morning" }]
}
```

---

## 8. Admin — Payroll

### `GET /api/admin/payroll?month=YYYY-MM`
```json
// Response
{
  "summary": {
    "total_payable": 1548000,
    "slips_generated": 80,
    "pending": 7,
    "total_deductions": 42000
  },
  "employees": [{
    "id": "emp_001",
    "employee_id": "VAGT-0042",
    "name": "Rajan Kumar",
    "days_in_month": 28,
    "days_worked": 26,
    "leaves_taken": 2,
    "gross_pay": 18000,
    "deductions": 500,
    "net_pay": 17500,
    "slip_status": "generated | pending",
    "slip_url": "https://..."
  }]
}
```

### `POST /api/admin/payroll/run`
```json
// Request
{ "month": "YYYY-MM" }
// Response
{ "success": true, "generated": 87 }
// Side effect: compute net pay for all active employees; notify employees
```

### `POST /api/admin/payroll/:employee_id/generate-slip`
```json
// Request
{ "month": "YYYY-MM" }
// Response
{ "slip_url": "https://api.vagtsecurityservices.com/payslips/..." }
// Side effect: generate PDF payslip; notify employee
```

---

## 9. Admin — Complaints

### `GET /api/admin/complaints?status=&priority=&site=&search=`
```json
[{
  "id": "cmp_001",
  "ticket_id": "TKT-2026-0042",
  "client_name": "EY India",
  "site": "EY Tower",
  "subject": "Guard absent Tuesday",
  "priority": "urgent | normal | low",
  "status": "open | in_progress | resolved",
  "submitted_at": "ISO 8601",
  "message": "string",
  "admin_note": "string (nullable)"
}]
```

### `GET /api/admin/complaints/:id`
Same as above (full detail).

### `POST /api/admin/complaints/:id/status`
```json
// Request
{ "status": "open | in_progress | resolved", "note": "string (optional)" }
// Response
{ "success": true }
// Side effect: notify client of status change
```

---

## 10. Admin — Reports & Analytics

### `GET /api/admin/reports?period=this_month|last_month|last_3_months|last_6_months|this_year`
```json
// Response
{
  "overview": {
    "avg_attendance_rate": 93.2,
    "incidents_reported": 4,
    "tickets_resolved": 11,
    "avg_resolution_hours": 18
  },
  "attendance_by_site": [
    { "site_name": "EY Tower", "rate": 97.1 },
    { "site_name": "HatsOff HQ", "rate": 89.4 }
  ],
  "sla_compliance": {
    "within_sla": 9,
    "breached": 2,
    "rate": 81.8
  },
  "incidents_by_type": [
    { "type_label": "Suspicious Activity", "count": 2 },
    { "type_label": "Trespassing", "count": 1 },
    { "type_label": "Equipment Failure", "count": 1 }
  ],
  "leave_utilisation": [
    { "leave_type_label": "Casual Leave",  "days_taken": 42, "days_available": 522 },
    { "leave_type_label": "Sick Leave",    "days_taken": 18, "days_available": 348 },
    { "leave_type_label": "Earned Leave",  "days_taken": 6,  "days_available": 174 }
  ],
  "guard_performance": [{
    "employee_id": "VAGT-0042",
    "name": "Rajan Kumar",
    "attendance_pct": 98.2,
    "incidents_filed": 2,
    "leaves_taken": 1,
    "rating": "excellent | good | needs_improvement"
  }]
}
```

---

## Rate Limiting

Recommended limits (enforce server-side):

| Endpoint group                  | Limit          |
|---------------------------------|----------------|
| `POST /api/auth/*`              | 10 req / 15min per IP |
| `POST /api/auth/employee/login` | 5 req / 15min per IP |
| All other endpoints             | 120 req / min per token |

Return `429 Too Many Requests` with:
```json
{ "message": "Too many requests. Please wait before trying again.", "retry_after_seconds": 60 }
```

---

## CORS

Allow:
- `https://vagtsecurityservices.com`
- `https://www.vagtsecurityservices.com`

Block all other origins in production.

---

## Database Notes (PostgreSQL / Prisma)

Key tables to plan for:
- `companies` — for future multi-tenant support; add `company_id` to every entity table
- `employees`, `clients`, `admins` — separate user tables per role, all with `company_id`
- `sites` — linked to both `companies` and `clients`
- `shifts` — one row per guard per day per shift type
- `attendance_logs` — check-in/out with timestamps and GPS (optional)
- `leave_requests` — with status workflow
- `payroll_runs` + `payslips`
- `incidents` — guard-reported, with severity and status
- `complaints` — client-reported tickets
- `daily_reports` — guard EOD log per site per shift
- `invoices` + `invoice_line_items`
- `audit_log` — every admin action logged with actor + timestamp

All timestamps stored as UTC. Return ISO 8601. Convert to IST on the frontend.
