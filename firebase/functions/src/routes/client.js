/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VAGT Security Services — Client Portal Routes
 * File: firebase/functions/src/routes/client.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHO CAN USE THESE ROUTES:
 *   Only logged-in clients (role === 'client') — typically a facility manager
 *   or HR contact at the company that has hired VAGT guards.
 *   Every route checks: valid Firebase token → correct role → then runs.
 *
 * ENDPOINTS IN THIS FILE:
 *   POST /api/complaints                    — Raise a new complaint / service request
 *   GET  /api/complaints                    — See all my complaints and their status
 *   GET  /api/client/deployment-summary     — Dashboard overview (guards, incidents, tickets)
 *   GET  /api/client/sites                  — Which sites does VAGT cover for me?
 *   GET  /api/client/reports                — View daily guard reports for my sites
 *   GET  /api/client/invoices/summary       — Outstanding / overdue / paid YTD amounts
 *   GET  /api/client/invoices               — Full invoice list with download links
 *
 * HOW COMPLAINTS WORK:
 *   1. Client raises complaint via POST /complaints → status = 'open'
 *   2. Admin sees it in the admin dashboard, investigates
 *   3. Admin updates status → 'in_progress' or 'resolved' (via admin routes)
 *   4. Client sees updated status in GET /complaints
 *
 * HOW INVOICES WORK:
 *   - Invoices are created manually by admin (no auto-generation yet)
 *   - Each invoice has a pdf_url field — the client clicks it to download
 *   - Status values: 'unpaid', 'overdue', 'paid', 'cancelled'
 *
 * INDIAN FISCAL YEAR NOTE:
 *   India's financial year runs April 1 to March 31.
 *   e.g. FY 2025–26 starts April 1, 2025.
 *   The invoices/summary endpoint uses this for "paid this year" calculation.
 *   The label shows as "FY 2025–26".
 *
 * GST NOTE (for when invoices get proper PDF generation):
 *   Invoices must show GSTIN, HSN/SAC code (SAC 998521 for security guards),
 *   18% GST, and the VAGT company address. This is a legal requirement.
 *   The current data model stores amount (gross) — consider adding gst_amount
 *   and base_amount fields when wiring proper invoice PDFs.
 *
 * DEBUG TIPS:
 *   Client sees no sites: their client_uid doesn't match any docs in 'sites'
 *     where sites.client_uid == their UID. Check Firestore directly.
 *   Deployment summary shows 0 guards: sites exist but guards_deployed field
 *     is 0 or missing on the site docs. Admin needs to update site records.
 *   Reports empty: No docs in 'daily_reports' collection for this client's sites.
 *     Guards must submit reports via the employee portal (or admin manually adds them).
 *   Invoice summary wrong amounts: Check that invoice docs have the correct
 *     status ('unpaid', 'overdue', 'paid') and amount (in rupees, not paise).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');

module.exports = function ({ db, requireAuth, requireClient }) {
  const router = express.Router();

  // Shorthand: every route needs both auth + client-role check
  const guard  = [requireAuth, requireClient];

  // ── POST /api/complaints ─────────────────────────────────────────────────
  // Client raises a complaint, service request, feedback, or emergency.
  // A unique ticket ID is generated (e.g. TKT-2026-4821) for tracking.
  //
  // Required body: { type, subject, description }
  // Optional body: { priority }   defaults to 'medium' if not provided
  //
  // TYPES:
  //   complaint       — Something went wrong (guard misconduct, no-show, etc.)
  //   service_request — Client wants a change (extra guard, different timing)
  //   feedback        — General comment (positive or negative)
  //   emergency       — Urgent security situation — treat as urgent
  //
  // PRIORITY: low | medium | high | urgent
  //   Admins should sort by priority when reviewing the queue.
  //   'urgent' tickets should trigger an SMS to the duty manager (TODO after MSG91).
  router.post('/complaints', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { type, priority, subject, description } = req.body || {};

    if (!type || !subject || !description) {
      return res.status(400).json({ message: 'type, subject, and description are required.' });
    }
    const validTypes     = ['complaint', 'service_request', 'feedback', 'emergency'];
    const validPriority  = ['low', 'medium', 'high', 'urgent'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: `type must be one of: ${validTypes.join(', ')}.` });
    }
    if (priority && !validPriority.includes(priority)) {
      return res.status(400).json({ message: `priority must be one of: ${validPriority.join(', ')}.` });
    }

    try {
      // Look up client's name so admin can see who raised the ticket
      const clientSnap = await db.collection('clients').doc(uid).get();
      const clientName = clientSnap.exists ? clientSnap.data().name : null;

      // Human-readable ticket number for reference in calls/emails
      const year = new Date().getFullYear();
      const ticketId = `TKT-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date();

      const ref = await db.collection('complaints').add({
        client_uid: uid,
        client_name: clientName,
        ticket_id: ticketId,
        type,
        priority: priority || 'medium',  // default to medium if not provided
        subject,
        description,
        status: 'open',       // admin changes to 'in_progress' or 'resolved'
        created_at: now,
        admin_note: null,     // admin can add a note when resolving
      });

      await logActivity(db, 'complaint', `New ${type} from ${clientName || uid}: ${subject}`, uid);

      return res.status(201).json({ id: ref.id, status: 'open', created_at: now.toISOString() });
    } catch (err) {
      console.error('POST /complaints error:', err);
      return res.status(500).json({ message: 'Failed to submit complaint.' });
    }
  });

  // ── GET /api/complaints ──────────────────────────────────────────────────
  // Returns all complaints raised by this client (last 50, newest first).
  // Client can see the status of each ticket and know if it's been resolved.
  router.get('/complaints', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('complaints')
        .where('client_uid', '==', uid)
        .orderBy('created_at', 'desc')
        .limit(50)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ticket_id: d.ticket_id,
          type: d.type,
          priority: d.priority,
          subject: d.subject,
          status: d.status,
          created_at: d.created_at ? d.created_at.toDate().toISOString() : null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('GET /complaints error:', err);
      return res.status(500).json({ message: 'Failed to fetch complaints.' });
    }
  });

  // ── GET /api/client/deployment-summary ───────────────────────────────────
  // Returns the four KPI numbers shown on the client dashboard homepage:
  //   - guards_on_duty: total guards currently deployed across all client's sites
  //   - sites_covered: how many sites have at least some coverage (not 'none')
  //   - incidents_this_month: incidents reported at client's sites this calendar month
  //   - open_tickets: how many complaints/requests are still open or in-progress
  //
  // All 3 Firestore queries run in parallel (Promise.all) for speed.
  //
  // NOTE: guards_on_duty is a stored number on each site doc (guards_deployed).
  // It's NOT computed from check-ins — it's manually set by admin when deploying
  // guards to a site. Until admin keeps this up to date, it may show stale data.
  // A better future approach: count attendance check-ins from today.
  router.get('/client/deployment-summary', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      // Run all 3 queries at the same time instead of one after another
      const [sitesSnap, openTicketsSnap, incidentsSnap] = await Promise.all([
        // All sites belonging to this client
        db.collection('sites').where('client_uid', '==', uid).get(),
        // Open or in-progress complaints (unresolved tickets)
        db.collection('complaints').where('client_uid', '==', uid).where('status', 'in', ['open', 'in_progress']).get(),
        // Incidents at client's sites filed this calendar month
        db.collection('incidents').where('site_client_uid', '==', uid).where('submitted_at', '>=', startOfMonth()).get(),
      ]);

      const sites = sitesSnap.docs.map(d => d.data());
      // Sum up all guards deployed across all sites
      const guardsOnDuty = sites.reduce((acc, s) => acc + (s.guards_deployed || 0), 0);
      // Sites with any coverage (exclude sites marked as 'none')
      const sitesCovered = sites.filter(s => s.coverage_status !== 'none').length;

      return res.json({
        guards_on_duty: guardsOnDuty,
        sites_covered: sitesCovered,
        incidents_this_month: incidentsSnap.size,
        open_tickets: openTicketsSnap.size,
      });
    } catch (err) {
      console.error('client/deployment-summary error:', err);
      return res.status(500).json({ message: 'Failed to fetch deployment summary.' });
    }
  });

  // ── GET /api/client/sites ────────────────────────────────────────────────
  // Returns a list of sites covered for this client.
  // Used to populate the site dropdown in the reports filter and complaint form.
  // Returns just { id, name } — enough for display and filtering.
  router.get('/client/sites', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('sites')
        .where('client_uid', '==', uid)
        .get();

      const items = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      return res.json(items);
    } catch (err) {
      console.error('client/sites error:', err);
      return res.status(500).json({ message: 'Failed to fetch sites.' });
    }
  });

  // ── GET /api/client/reports ──────────────────────────────────────────────
  // Returns daily guard reports for the client's sites.
  // Reports are filed by guards (or admin) via the daily_reports collection.
  //
  // Optional query params:
  //   ?site=siteId            → filter to one site
  //   ?type=report_type       → filter by report type (e.g. 'daily', 'incident')
  //   ?month=YYYY-MM          → filter to a specific month (e.g. '2026-03')
  //
  // NOTE on month filter: We use 'YYYY-MM-01' to 'YYYY-MM-31' as range boundaries.
  // Months with fewer than 31 days still work — Firestore just won't find docs
  // after the last real day (e.g. 'Feb-31' returns nothing extra, that's fine).
  //
  // NOTE: This query requires a Firestore composite index on:
  //   (site_client_uid, date) — add this in Firebase Console if the query fails
  //   with "index required" error.
  router.get('/client/reports', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { site, type, month } = req.query;
    try {
      let query = db.collection('daily_reports')
        .where('site_client_uid', '==', uid)
        .orderBy('date', 'desc');

      // Apply optional filters if provided
      if (site)  query = query.where('site_id', '==', site);
      if (type)  query = query.where('report_type', '==', type);
      if (month) {
        // Filter by month: '2026-03' → dates from '2026-03-01' to '2026-03-31'
        query = query
          .where('date', '>=', month + '-01')
          .where('date', '<=', month + '-31');
      }

      const snap = await query.limit(50).get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.date,
          site_id: d.site_id,
          site_name: d.site_name,
          report_type: d.report_type,
          guard_name: d.guard_name,
          summary: d.summary,
          details: d.details || null,
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('client/reports error:', err);
      return res.status(500).json({ message: 'Failed to fetch reports.' });
    }
  });

  // ── GET /api/client/invoices/summary ────────────────────────────────────
  // Returns the financial summary shown at the top of the invoices page:
  //   outstanding_amount — total unpaid + overdue (what they owe right now)
  //   overdue_amount     — portion of outstanding that is past due date
  //   paid_ytd           — how much they've paid in the current Indian fiscal year
  //   total_invoices     — total number of invoices ever raised for this client
  //   fiscal_year_label  — e.g. "FY 2025–26" (displayed in UI)
  //
  // INDIAN FISCAL YEAR LOGIC:
  //   India FY runs April 1 – March 31.
  //   If today is Jan 2026, current FY is 2025–26 (started Apr 1, 2025).
  //   fyStart = '{currentYear - 1}-04-01'
  //   Example: currentYear = 2026 → fyStart = '2025-04-01'
  //
  // NOTE: This fetches ALL invoices for the client with no limit — could be
  // slow for clients with hundreds of invoices. Consider adding a date filter
  // once the platform has >2 years of invoice history.
  router.get('/client/invoices/summary', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('invoices')
        .where('client_uid', '==', uid)
        .get();

      let outstanding = 0, overdue = 0, paidYtd = 0;
      const currentYear = new Date().getFullYear();
      // Indian FY starts April 1 of the previous calendar year
      const fyStart = `${currentYear - 1}-04-01`;

      snap.docs.forEach(doc => {
        const d = doc.data();
        // Add unpaid invoices to outstanding balance
        if (d.status === 'unpaid') outstanding += d.amount || 0;
        // Overdue invoices count toward both outstanding and overdue totals
        if (d.status === 'overdue') { outstanding += d.amount || 0; overdue += d.amount || 0; }
        // Paid invoices count toward YTD only if paid within current FY
        if (d.status === 'paid' && d.issued_date >= fyStart) paidYtd += d.amount || 0;
      });

      return res.json({
        outstanding_amount: outstanding,
        overdue_amount: overdue,
        paid_ytd: paidYtd,
        total_invoices: snap.size,
        fiscal_year_label: `FY ${currentYear - 1}–${String(currentYear).slice(2)}`,
        // e.g. FY 2025–26
      });
    } catch (err) {
      console.error('client/invoices/summary error:', err);
      return res.status(500).json({ message: 'Failed to fetch invoice summary.' });
    }
  });

  // ── GET /api/client/invoices ─────────────────────────────────────────────
  // Returns the client's full invoice list (last 50, newest first).
  // Each invoice has a pdf_url — the client taps it to download the PDF.
  //
  // INVOICE STATUS VALUES:
  //   unpaid    — Issued but not yet paid, and not past due date
  //   overdue   — Past the due_date and still unpaid
  //   paid      — Payment received (paid_amount shows how much)
  //   cancelled — Invoice voided (ignore in financial calculations)
  //
  // NOTE: PDF generation is not yet automated. Currently admin uploads a PDF
  // and pastes the download URL into the invoice doc manually. Future plan:
  // auto-generate PDFs with proper GST formatting using a PDF library.
  router.get('/client/invoices', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('invoices')
        .where('client_uid', '==', uid)
        .orderBy('issued_date', 'desc')   // newest invoice first
        .limit(50)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          invoice_number: d.invoice_number,  // e.g. 'VAGT-2026-0042'
          period_label: d.period_label,       // e.g. 'February 2026'
          issued_date: d.issued_date,         // 'YYYY-MM-DD'
          due_date: d.due_date,               // 'YYYY-MM-DD'
          amount: d.amount,                   // total amount in ₹ (including GST)
          status: d.status,                   // unpaid | overdue | paid | cancelled
          paid_amount: d.paid_amount || null, // non-null only if partial payment received
          pdf_url: d.pdf_url || null,         // null = PDF not uploaded yet
        };
      });

      return res.json(items);
    } catch (err) {
      console.error('client/invoices error:', err);
      return res.status(500).json({ message: 'Failed to fetch invoices.' });
    }
  });

  return { router };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns the first moment of the current calendar month (midnight on the 1st).
// Used to filter "incidents this month" in the deployment summary.
// This uses the Cloud Function's UTC timezone — for IST-aligned month boundaries,
// adjust to IST: new Date(d.getFullYear(), d.getMonth(), 1, -5, -30)
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Writes a line to the activity_log collection so the admin dashboard can
// show a real-time feed of what clients are doing. Failures here are non-fatal.
async function logActivity(db, type, description, actor) {
  try {
    await db.collection('activity_log').add({ type, description, actor, time: new Date() });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
