/**
 * Client portal routes (self-service)
 *
 * All routes require a valid Firebase ID token with role === 'client'.
 *
 * POST /api/complaints
 * GET  /api/complaints
 * GET  /api/client/deployment-summary
 * GET  /api/client/sites
 * GET  /api/client/reports
 * GET  /api/client/invoices/summary
 * GET  /api/client/invoices
 */

'use strict';

const express = require('express');

module.exports = function ({ db, requireAuth, requireClient }) {
  const router = express.Router();
  const guard  = [requireAuth, requireClient];

  // ── POST /api/complaints ─────────────────────────────────────────────────
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
      const clientSnap = await db.collection('clients').doc(uid).get();
      const clientName = clientSnap.exists ? clientSnap.data().name : null;
      const year = new Date().getFullYear();
      const ticketId = `TKT-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date();

      const ref = await db.collection('complaints').add({
        client_uid: uid,
        client_name: clientName,
        ticket_id: ticketId,
        type,
        priority: priority || 'medium',
        subject,
        description,
        status: 'open',
        created_at: now,
        admin_note: null,
      });

      await logActivity(db, 'complaint', `New ${type} from ${clientName || uid}: ${subject}`, uid);

      return res.status(201).json({ id: ref.id, status: 'open', created_at: now.toISOString() });
    } catch (err) {
      console.error('POST /complaints error:', err);
      return res.status(500).json({ message: 'Failed to submit complaint.' });
    }
  });

  // ── GET /api/complaints ──────────────────────────────────────────────────
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
  router.get('/client/deployment-summary', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const [sitesSnap, openTicketsSnap, incidentsSnap] = await Promise.all([
        db.collection('sites').where('client_uid', '==', uid).get(),
        db.collection('complaints').where('client_uid', '==', uid).where('status', 'in', ['open', 'in_progress']).get(),
        db.collection('incidents').where('site_client_uid', '==', uid).where('submitted_at', '>=', startOfMonth()).get(),
      ]);

      const sites = sitesSnap.docs.map(d => d.data());
      const guardsOnDuty   = sites.reduce((acc, s) => acc + (s.guards_deployed || 0), 0);
      const sitesCovered   = sites.filter(s => s.coverage_status !== 'none').length;

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
  router.get('/client/reports', ...guard, async (req, res) => {
    const uid = req.user.uid;
    const { site, type, month } = req.query;
    try {
      let query = db.collection('daily_reports')
        .where('site_client_uid', '==', uid)
        .orderBy('date', 'desc');

      if (site) query = query.where('site_id', '==', site);
      if (type) query = query.where('report_type', '==', type);
      if (month) {
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
  router.get('/client/invoices/summary', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('invoices')
        .where('client_uid', '==', uid)
        .get();

      let outstanding = 0, overdue = 0, paidYtd = 0;
      const currentYear = new Date().getFullYear();
      const fyStart = `${currentYear - 1}-04-01`; // Indian FY: Apr–Mar

      snap.docs.forEach(doc => {
        const d = doc.data();
        if (d.status === 'unpaid') outstanding += d.amount || 0;
        if (d.status === 'overdue') { outstanding += d.amount || 0; overdue += d.amount || 0; }
        if (d.status === 'paid' && d.issued_date >= fyStart) paidYtd += d.amount || 0;
      });

      return res.json({
        outstanding_amount: outstanding,
        overdue_amount: overdue,
        paid_ytd: paidYtd,
        total_invoices: snap.size,
        fiscal_year_label: `FY ${currentYear - 1}–${String(currentYear).slice(2)}`,
      });
    } catch (err) {
      console.error('client/invoices/summary error:', err);
      return res.status(500).json({ message: 'Failed to fetch invoice summary.' });
    }
  });

  // ── GET /api/client/invoices ─────────────────────────────────────────────
  router.get('/client/invoices', ...guard, async (req, res) => {
    const uid = req.user.uid;
    try {
      const snap = await db.collection('invoices')
        .where('client_uid', '==', uid)
        .orderBy('issued_date', 'desc')
        .limit(50)
        .get();

      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          invoice_number: d.invoice_number,
          period_label: d.period_label,
          issued_date: d.issued_date,
          due_date: d.due_date,
          amount: d.amount,
          status: d.status,
          paid_amount: d.paid_amount || null,
          pdf_url: d.pdf_url || null,
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

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function logActivity(db, type, description, actor) {
  try {
    await db.collection('activity_log').add({ type, description, actor, time: new Date() });
  } catch (e) {
    console.warn('logActivity failed:', e.message);
  }
}
