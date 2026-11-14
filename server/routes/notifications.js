import express from 'express';
import { all, get, run, insert, update, remove, now } from '../db.js';
import { requireAuth, requireCapability } from '../auth.js';
import { can } from '../security.js';
import { publish } from '../bus.js';
import { getMaskedSmtpStatus, testSmtpConnection, sendMail } from '../notifications/smtp.js';
import { getQueueStatus, retryDelivery } from '../notifications/queue.js';
import { triggerManualEscalation } from '../notifications/escalation.js';
import { getUserPreferences } from '../notifications/recipients.js';
import { dispatchNotificationEvent } from '../notifications/dispatcher.js';

export function notificationsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  /**
   * GET /api/notifications
   * Fetch in-app notifications for the authenticated user with filtering & unread count.
   */
  router.get('/', (req, res) => {
    const userId = req.user.id;
    const category = req.query.category;
    const unreadOnly = req.query.unread === 'true';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 40)));

    const clauses = ['(user_id = ? OR user_id IS NULL)', 'archived = 0'];
    const params = [userId];

    if (category && category !== 'all') {
      clauses.push('category = ?');
      params.push(category);
    }
    if (unreadOnly) {
      clauses.push('read = 0');
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const notifications = all(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
      [...params, limit],
    );

    const unreadCount = get(
      'SELECT COUNT(*) AS count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND read = 0 AND archived = 0',
      [userId],
    )?.count || 0;

    res.json({
      notifications: notifications.map((n) => ({ ...n, read: Boolean(n.read) })),
      unread: unreadCount,
      total: notifications.length,
    });
  });

  /**
   * PATCH /api/notifications/:id/read
   * Mark a single in-app notification as read.
   */
  router.patch('/:id/read', (req, res) => {
    const notif = get('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    if (notif.user_id && notif.user_id !== req.user.id && !can(req.user.role, 'all:view')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    publish('sync', { entity: 'notifications', action: 'refresh' });
    res.json({ ok: true });
  });

  /**
   * PATCH /api/notifications/read-all
   * Mark all notifications for this user as read.
   */
  router.patch('/read-all', (req, res) => {
    run('UPDATE notifications SET read = 1 WHERE (user_id = ? OR user_id IS NULL) AND read = 0', [req.user.id]);
    publish('sync', { entity: 'notifications', action: 'refresh' });
    res.json({ ok: true });
  });

  /**
   * DELETE /api/notifications/:id
   * Archive/delete an in-app notification.
   */
  router.delete('/:id', (req, res) => {
    const notif = get('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found.' });
    if (notif.user_id && notif.user_id !== req.user.id && !can(req.user.role, 'all:view')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    run('UPDATE notifications SET archived = 1 WHERE id = ?', [req.params.id]);
    publish('sync', { entity: 'notifications', action: 'refresh' });
    res.json({ ok: true });
  });

  /**
   * GET /api/notifications/preferences
   * Fetch current user's notification preferences.
   */
  router.get('/preferences', (req, res) => {
    const prefs = getUserPreferences(req.user.id);
    res.json({ preferences: prefs });
  });

  /**
   * PATCH /api/notifications/preferences
   * Update current user's notification settings.
   */
  router.patch('/preferences', (req, res) => {
    const body = req.body || {};
    const existing = get('SELECT id FROM notification_preferences WHERE user_id = ?', [req.user.id]);

    const data = {
      user_id: req.user.id,
      email_enabled: body.email_enabled !== undefined ? (body.email_enabled ? 1 : 0) : 1,
      in_app_enabled: body.in_app_enabled !== undefined ? (body.in_app_enabled ? 1 : 0) : 1,
      sms_enabled: body.sms_enabled !== undefined ? (body.sms_enabled ? 1 : 0) : 0,
      preferred_email: body.preferred_email !== undefined ? String(body.preferred_email).trim() : null,
      preferred_phone: body.preferred_phone !== undefined ? String(body.preferred_phone).trim() : null,
      notify_assignments: body.notify_assignments !== undefined ? (body.notify_assignments ? 1 : 0) : 1,
      notify_status_updates: body.notify_status_updates !== undefined ? (body.notify_status_updates ? 1 : 0) : 1,
      notify_public_alerts: body.notify_public_alerts !== undefined ? (body.notify_public_alerts ? 1 : 0) : 1,
      notify_team_comms: body.notify_team_comms !== undefined ? (body.notify_team_comms ? 1 : 0) : 1,
      notify_escalations: body.notify_escalations !== undefined ? (body.notify_escalations ? 1 : 0) : 1,
      min_severity: Math.min(5, Math.max(1, Number(body.min_severity || 1))),
      updated_at: now(),
    };

    if (existing) {
      update('notification_preferences', existing.id, data);
    } else {
      insert('notification_preferences', data);
    }

    res.json({ ok: true, preferences: getUserPreferences(req.user.id) });
  });

  /**
   * GET /api/notifications/smtp-status
   * Retrieve current SMTP configuration and live connectivity status.
   */
  router.get('/smtp-status', async (req, res) => {
    const masked = getMaskedSmtpStatus();
    res.json({ smtp: masked });
  });

  /**
   * POST /api/notifications/test
   * Tests SMTP connection and optionally sends a verification test email.
   */
  router.post('/test', async (req, res) => {
    if (!can(req.user.role, 'settings:manage')) {
      return res.status(403).json({ error: 'Administrator permission required to test SMTP infrastructure.' });
    }

    const sendTestEmail = Boolean(req.body?.send_email);
    const targetEmail = req.body?.email || req.user.email;

    // 1. Test transport connectivity
    const conn = await testSmtpConnection();

    // 2. If requested and connected, send actual test email
    let emailResult = null;
    if (sendTestEmail && conn.connected) {
      const masked = getMaskedSmtpStatus();
      const { TEMPLATE_GENERATORS } = await import('../notifications/templates.js');
      const testTpl = TEMPLATE_GENERATORS.test_notification({
        recipientEmail: targetEmail,
        recipientName: req.user.name,
        serverTime: now(),
        provider: masked.provider,
        maskedUser: masked.maskedUser,
      });

      emailResult = await sendMail({
        to: targetEmail,
        subject: testTpl.subject,
        html: testTpl.html,
        text: testTpl.text,
        priority: 'normal',
      });
    }

    res.json({
      connection: conn,
      emailSent: emailResult?.accepted || false,
      emailResult,
      targetEmail,
    });
  });

  /**
   * GET /api/notifications/queue-status
   * Health and real-time processing stats of the background notification queue.
   */
  router.get('/queue-status', (req, res) => {
    const status = getQueueStatus();
    res.json({ queue: status });
  });

  /**
   * GET /api/notifications/status
   * Full Notification Delivery Monitoring Dashboard stats (Phase 7).
   */
  router.get('/status', (req, res) => {
    const totalDeliveries = get('SELECT COUNT(*) AS count FROM notification_delivery_logs')?.count || 0;
    const acceptedEmails = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE channel = 'email' AND status IN ('accepted', 'delivered')")?.count || 0;
    const pendingNotifications = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE status IN ('pending', 'queued', 'processing', 'retrying')")?.count || 0;
    const failedNotifications = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE status = 'failed'")?.count || 0;
    const criticalNotifications = get('SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE severity >= 5')?.count || 0;
    const inAppCount = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE channel = 'in_app'")?.count || 0;
    const smsCount = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE channel = 'sms'")?.count || 0;

    const queueStatus = getQueueStatus();
    const smtpStatus = getMaskedSmtpStatus();

    // Channel breakdown
    const channelStats = all(`
      SELECT channel, status, COUNT(*) AS count
      FROM notification_delivery_logs
      GROUP BY channel, status
    `);

    res.json({
      monitoring: {
        totalDeliveries,
        acceptedEmails,
        pendingNotifications,
        failedNotifications,
        criticalNotifications,
        inAppCount,
        smsCount,
        queueStatus,
        smtpStatus,
        channelStats,
        lastUpdated: now(),
      },
    });
  });

  /**
   * GET /api/notifications/history
   * Complete delivery audit history with search, channel filter, status filter, and pagination.
   */
  router.get('/history', (req, res) => {
    const clauses = [];
    const params = [];

    if (req.query.status && req.query.status !== 'all') {
      clauses.push('status = ?');
      params.push(req.query.status);
    }
    if (req.query.channel && req.query.channel !== 'all') {
      clauses.push('channel = ?');
      params.push(req.query.channel);
    }
    if (req.query.severity && req.query.severity !== 'all') {
      clauses.push('severity = ?');
      params.push(Number(req.query.severity));
    }
    if (req.query.incident_id) {
      clauses.push('incident_id = ?');
      params.push(Number(req.query.incident_id));
    }
    if (req.query.q) {
      const term = `%${String(req.query.q).toLowerCase()}%`;
      clauses.push('(lower(recipient_address) LIKE ? OR lower(recipient_name) LIKE ? OR lower(event_id) LIKE ?)');
      params.push(term, term, term);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const total = get(`SELECT COUNT(*) AS count FROM notification_delivery_logs ${where}`, params)?.count || 0;
    const rows = all(
      `SELECT * FROM notification_delivery_logs ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.json({ logs: rows, total, limit, offset });
  });

  /**
   * POST /api/notifications/:id/retry
   * Manually retry a failed notification delivery.
   */
  router.post('/:id/retry', async (req, res) => {
    if (!can(req.user.role, 'settings:manage') && !can(req.user.role, 'incident:update')) {
      return res.status(403).json({ error: 'Permission denied to retry delivery.' });
    }

    try {
      const result = await retryDelivery(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * GET /api/notifications/escalations
   * Fetch active and historical emergency escalations.
   */
  router.get('/escalations', (req, res) => {
    const status = req.query.status || 'all';
    const clauses = [];
    const params = [];
    if (status !== 'all') {
      clauses.push('status = ?');
      params.push(status);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = all(
      `SELECT e.*, i.code AS incident_code, i.title AS incident_title, i.severity AS incident_severity, i.zone AS incident_zone
       FROM notification_escalations e
       LEFT JOIN incidents i ON i.id = e.incident_id
       ${where}
       ORDER BY e.stage DESC, e.triggered_at DESC`,
      params,
    );

    res.json({
      escalations: rows.map((row) => ({
        ...row,
        history: (() => {
          try { return JSON.parse(row.history_json || '[]'); } catch { return []; }
        })(),
      })),
      total: rows.length,
    });
  });

  /**
   * POST /api/notifications/escalations/:id/trigger
   * Manually advance an escalation to the next tier.
   */
  router.post('/escalations/:id/trigger', async (req, res) => {
    if (!can(req.user.role, 'incident:assign') && !can(req.user.role, 'settings:manage')) {
      return res.status(403).json({ error: 'Unauthorized to advance escalation.' });
    }

    const note = req.body?.note || 'Manual escalation invoked by command operator';
    try {
      await triggerManualEscalation(req.params.id, req.user.name, note);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /api/notifications/send
   * Authorized manual broadcast / custom emergency notification.
   */
  router.post('/send', async (req, res) => {
    if (!can(req.user.role, 'broadcast:manage')) {
      return res.status(403).json({ error: 'Permission denied.' });
    }

    const { eventType, incidentId, title, message, severity, zone } = req.body;
    let incident = null;
    if (incidentId) {
      incident = get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
    }

    const results = await dispatchNotificationEvent(
      eventType || 'incident_new',
      {
        incident: incident || {
          code: `MANUAL-${Date.now().toString().slice(-4)}`,
          title: title || 'Emergency Dispatch Notification',
          description: message,
          severity: Number(severity || 3),
          zone: zone || 'Central Chennai',
          status: 'pending',
          created_at: now(),
        },
        title,
        message,
        severity: Number(severity || 3),
      },
      {
        actorId: req.user.id,
        actorName: req.user.name,
      },
    );

    res.status(201).json({ ok: true, results });
  });

  return router;
}

