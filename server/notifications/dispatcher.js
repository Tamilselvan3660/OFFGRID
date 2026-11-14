import crypto from 'node:crypto';
import { all, get, insert, now } from '../db.js';
import { publish, notify } from '../bus.js';
import { resolveRecipients } from './recipients.js';
import { formatEmailTemplate } from './templates.js';
import { enqueueNotificationJob } from './queue.js';
import { startEscalationTracking } from './escalation.js';

/**
 * Dispatches an emergency notification across all authorized channels.
 *
 * @param {string} eventType One of the 12 core event types:
 *   - 'sos_activated'
 *   - 'incident_new'
 *   - 'critical_detected'
 *   - 'team_assigned'
 *   - 'team_reassigned'
 *   - 'status_changed'
 *   - 'incident_resolved'
 *   - 'duplicate_detected'
 *   - 'broadcast_published'
 *   - 'assignment_overdue'
 *   - 'team_acknowledged'
 *   - 'escalation_triggered'
 *   - 'test_notification'
 * @param {object} payload Event payload (incident, team, actor, etc.)
 * @param {object} options Optional overrides
 */
export async function dispatchNotificationEvent(eventType, payload = {}, options = {}) {
  const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const incident = payload.incident || null;
  const severity = Number(incident?.severity || payload.severity || 2);
  const isCritical = severity >= 5 || incident?.source === 'sos' || eventType === 'sos_activated' || eventType === 'escalation_triggered';

  // 1. Audit log the notification event
  insert('notification_events', {
    event_id: eventId,
    incident_id: incident?.id || null,
    event_type: eventType,
    actor_id: options.actorId || null,
    actor_name: options.actorName || 'OFFGRID Dispatch Engine',
    payload_json: JSON.stringify({
      incidentCode: incident?.code,
      title: incident?.title || payload.title,
      severity,
      zone: incident?.zone || payload.zone,
      timestamp: now(),
    }),
    created_at: now(),
  });

  // 2. Intelligent Recipient Selection
  const recipients = options.recipients || resolveRecipients(eventType, payload);

  // 3. Render branded template
  const template = formatEmailTemplate(eventType, payload);

  const priorityScore = isCritical ? 100 : severity >= 4 ? 75 : 50;
  const priorityName = isCritical ? 'immediate' : severity >= 4 ? 'high' : 'normal';

  const results = {
    eventId,
    recipientsCount: recipients.length,
    inAppDelivered: 0,
    emailEnqueued: 0,
    smsEnqueued: 0,
  };

  // 4. Distribute to each recipient across authorized channels
  for (const recipient of recipients) {
    const channels = recipient.channels || ['in_app', 'email'];

    // Channel A: Real-Time In-App Notification & SSE
    if (channels.includes('in_app')) {
      const notifKind = isCritical ? 'critical' : severity >= 4 ? 'warning' : 'info';
      const link = incident ? `/incidents?open=${incident.id}` : '/notifications';

      const inAppId = insert('notifications', {
        user_id: recipient.id,
        incident_id: incident?.id || null,
        event_id: eventId,
        category: getCategoryForEvent(eventType),
        title: template.subject.replace(/^\[.*?\]\s*/, ''),
        body: template.text.split('\n')[0].slice(0, 300),
        kind: notifKind,
        link,
        read: 0,
        archived: 0,
        channel: 'in_app',
        created_at: now(),
      });

      // Record in delivery logs as accepted
      insert('notification_delivery_logs', {
        notification_id: inAppId,
        event_id: eventId,
        incident_id: incident?.id || null,
        recipient_id: recipient.id,
        recipient_address: `user:${recipient.id}`,
        recipient_name: recipient.name,
        channel: 'in_app',
        severity,
        priority: priorityName,
        status: 'delivered',
        retry_count: 0,
        max_retries: 0,
        error_message: null,
        provider_response: 'Delivered to In-App notification center',
        created_at: now(),
        processed_at: now(),
        delivered_at: now(),
      });

      results.inAppDelivered += 1;
    }

    // Channel B: Background SMTP Email Queue
    if (channels.includes('email') && recipient.email) {
      const emailLogId = insert('notification_delivery_logs', {
        notification_id: null,
        event_id: eventId,
        incident_id: incident?.id || null,
        recipient_id: recipient.id,
        recipient_address: recipient.email,
        recipient_name: recipient.name,
        channel: 'email',
        severity,
        priority: priorityName,
        status: 'queued',
        retry_count: 0,
        max_retries: isCritical ? 5 : 3,
        error_message: null,
        provider_response: null,
        created_at: now(),
        processed_at: null,
        delivered_at: null,
      });

      enqueueNotificationJob({
        eventId,
        deliveryLogId: emailLogId,
        channel: 'email',
        priorityScore,
        payload: {
          to: `"${recipient.name}" <${recipient.email}>`,
          subject: template.subject,
          html: template.html,
          text: template.text,
          priority: priorityName,
        },
      });

      results.emailEnqueued += 1;
    }

    // Channel C: Optional Mobile SMS
    if (channels.includes('sms') && recipient.phone) {
      const smsLogId = insert('notification_delivery_logs', {
        notification_id: null,
        event_id: eventId,
        incident_id: incident?.id || null,
        recipient_id: recipient.id,
        recipient_address: recipient.phone,
        recipient_name: recipient.name,
        channel: 'sms',
        severity,
        priority: priorityName,
        status: 'queued',
        retry_count: 0,
        max_retries: 2,
        error_message: null,
        provider_response: null,
        created_at: now(),
        processed_at: null,
        delivered_at: null,
      });

      enqueueNotificationJob({
        eventId,
        deliveryLogId: smsLogId,
        channel: 'sms',
        priorityScore,
        payload: {
          to: recipient.phone,
          message: `OFFGRID EMERGENCY: ${template.subject.slice(0, 100)}. Link: http://localhost:5173/incidents`,
        },
      });

      results.smsEnqueued += 1;
    }
  }

  // 5. Broadcast Real-Time SSE Event to All Active Dashboards
  publish('notification_event', {
    eventId,
    eventType,
    incidentId: incident?.id,
    incidentCode: incident?.code,
    title: template.subject,
    severity,
    priority: priorityName,
    summary: template.text.split('\n')[0],
    timestamp: now(),
  });
  publish('sync', { entity: 'notifications', action: 'create' });
  publish('sync', { entity: 'notification_delivery_logs', action: 'create' });

  // 6. If SOS, ensure automatic escalation tracking is active
  if (eventType === 'sos_activated' && incident) {
    startEscalationTracking(incident.id, payload.nearestTeam);
  }

  return results;
}

function getCategoryForEvent(eventType) {
  if (eventType.includes('sos')) return 'sos';
  if (eventType.includes('incident_new') || eventType.includes('critical')) return 'incident_new';
  if (eventType.includes('assigned') || eventType.includes('reassigned')) return 'assignment';
  if (eventType.includes('status') || eventType.includes('resolved') || eventType.includes('duplicate')) return 'status_change';
  if (eventType.includes('broadcast')) return 'public_alert';
  if (eventType.includes('escalation')) return 'escalation';
  if (eventType.includes('team')) return 'team_comm';
  return 'system';
}

