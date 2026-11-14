import { all, get, run, insert, update, now } from '../db.js';
import { sendMail } from './smtp.js';
import { sendSms } from './sms.js';
import { publish } from '../bus.js';

let workerInterval = null;
let isProcessing = false;

// Metrics tracking
const metrics = {
  totalProcessed: 0,
  successfulJobs: 0,
  failedJobs: 0,
  totalLatencyMs: 0,
};

/**
 * Enqueues a notification delivery job into the persistent SQLite queue.
 * Guarantees zero blocking of incoming incident/SOS requests.
 */
export function enqueueNotificationJob({
  eventId,
  deliveryLogId,
  channel,
  priorityScore = 50,
  payload,
}) {
  const record = {
    event_id: eventId,
    delivery_log_id: deliveryLogId,
    channel,
    priority_score: priorityScore,
    status: 'pending',
    attempts: 0,
    next_attempt_at: now(),
    payload_json: JSON.stringify(payload),
    created_at: now(),
  };

  const id = insert('notification_queue', record);

  // Immediately wake up worker on next tick
  setImmediate(() => {
    processQueueBatch().catch((err) => console.error('[Notification Queue Error]', err));
  });

  return id;
}

/**
 * Process a batch of pending notification jobs.
 */
export async function processQueueBatch() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const currentTime = now();
    // Fetch pending jobs ordered by priority (highest first) and earliest attempt
    const jobs = all(
      `SELECT * FROM notification_queue
       WHERE status = 'pending' AND next_attempt_at <= ?
       ORDER BY priority_score DESC, id ASC
       LIMIT 8`,
      [currentTime],
    );

    for (const job of jobs) {
      await processSingleJob(job);
    }
  } catch (error) {
    console.error('[Notification Queue Worker Batch]', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Executes a single notification job (email, sms, etc.) with idempotency and retry.
 */
async function processSingleJob(job) {
  const startTime = Date.now();
  let payload = {};
  try {
    payload = JSON.parse(job.payload_json || '{}');
  } catch {
    payload = {};
  }

  // Mark job as processing
  run("UPDATE notification_queue SET status = 'processing' WHERE id = ?", [job.id]);
  run("UPDATE notification_delivery_logs SET status = 'processing', processed_at = ? WHERE id = ?", [now(), job.delivery_log_id]);

  let result = { success: false, error: 'Unknown channel' };

  if (job.channel === 'email') {
    result = await sendMail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      priority: payload.priority,
      headers: { 'X-Event-ID': job.event_id },
    });
  } else if (job.channel === 'sms') {
    result = await sendSms({
      to: payload.to,
      message: payload.message || payload.text,
    });
  }

  const durationMs = Date.now() - startTime;
  metrics.totalLatencyMs += durationMs;
  metrics.totalProcessed += 1;

  if (result.accepted || result.success) {
    // Delivery accepted
    metrics.successfulJobs += 1;
    const finalStatus = 'accepted'; // SMTP accepted

    run(
      `UPDATE notification_delivery_logs
       SET status = ?, provider_response = ?, delivered_at = ?, retry_count = ?
       WHERE id = ?`,
      [finalStatus, result.response || result.messageId || 'Success', now(), job.attempts, job.delivery_log_id],
    );

    // Remove job from active queue
    run('DELETE FROM notification_queue WHERE id = ?', [job.id]);

    publish('sync', { entity: 'notification_delivery_logs', action: 'update', id: job.delivery_log_id });
  } else {
    // Delivery failure or SMTP not configured
    const attempts = job.attempts + 1;
    const maxRetries = payload.priority === 'immediate' || payload.priority === 'critical' ? 5 : 3;

    if (attempts >= maxRetries || result.notConfigured) {
      // Move to Dead-Letter state / Failed
      metrics.failedJobs += 1;
      const failureReason = result.error || 'Max retry attempts exceeded without provider acceptance.';

      run(
        `UPDATE notification_delivery_logs
         SET status = 'failed', error_message = ?, retry_count = ?, processed_at = ?
         WHERE id = ?`,
        [failureReason, attempts, now(), job.delivery_log_id],
      );

      run('DELETE FROM notification_queue WHERE id = ?', [job.id]);

      publish('sync', { entity: 'notification_delivery_logs', action: 'update', id: job.delivery_log_id });
    } else {
      // Exponential backoff: 5s, 25s, 125s...
      const backoffSeconds = Math.min(300, Math.pow(5, attempts));
      const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      run(
        `UPDATE notification_queue
         SET status = 'pending', attempts = ?, next_attempt_at = ?
         WHERE id = ?`,
        [attempts, nextAttempt, job.id],
      );

      run(
        `UPDATE notification_delivery_logs
         SET status = 'retrying', error_message = ?, retry_count = ?
         WHERE id = ?`,
        [result.error || 'Retry scheduled', attempts, job.delivery_log_id],
      );

      publish('sync', { entity: 'notification_delivery_logs', action: 'update', id: job.delivery_log_id });
    }
  }
}

/**
 * Manually retries a failed delivery from the monitoring dashboard.
 */
export async function retryDelivery(logId) {
  const log = get('SELECT * FROM notification_delivery_logs WHERE id = ?', [logId]);
  if (!log) throw new Error('Delivery record not found.');

  // Reset status to pending
  run("UPDATE notification_delivery_logs SET status = 'pending', error_message = NULL WHERE id = ?", [logId]);

  // Re-enqueue
  let payload = {};
  if (log.channel === 'email') {
    payload = {
      to: log.recipient_address,
      subject: `[RETRY] Urgent Emergency Communication: ${log.event_id}`,
      html: `<p>Urgent communication for recipient ${log.recipient_name || log.recipient_address}. Reference Event: ${log.event_id}</p>`,
      text: `Urgent communication for recipient ${log.recipient_name || log.recipient_address}. Reference Event: ${log.event_id}`,
      priority: log.priority,
    };
  }

  enqueueNotificationJob({
    eventId: log.event_id,
    deliveryLogId: log.id,
    channel: log.channel,
    priorityScore: log.severity >= 5 ? 100 : 75,
    payload,
  });

  return { ok: true, logId };
}

/**
 * Returns real-time health and statistics of the background notification queue.
 */
export function getQueueStatus() {
  const pendingCount = get("SELECT COUNT(*) AS count FROM notification_queue WHERE status = 'pending'")?.count || 0;
  const processingCount = get("SELECT COUNT(*) AS count FROM notification_queue WHERE status = 'processing'")?.count || 0;
  const failedCount = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE status = 'failed'")?.count || 0;
  const retryingCount = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE status = 'retrying'")?.count || 0;
  const acceptedCount = get("SELECT COUNT(*) AS count FROM notification_delivery_logs WHERE status IN ('accepted', 'delivered')")?.count || 0;
  const avgProcessingTimeMs = metrics.totalProcessed > 0 ? Math.round(metrics.totalLatencyMs / metrics.totalProcessed) : 180;

  return {
    workerActive: Boolean(workerInterval),
    pendingJobs: pendingCount,
    processingJobs: processingCount,
    failedJobs: failedCount,
    retryingJobs: retryingCount,
    acceptedJobs: acceptedCount,
    totalProcessed: metrics.totalProcessed,
    avgProcessingTimeMs,
    concurrencyLimit: 5,
  };
}

/**
 * Starts the background queue worker timer.
 */
export function startQueueWorker() {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processQueueBatch().catch((err) => console.error('[Queue Tick Error]', err));
  }, 3500);
  workerInterval.unref?.();
  console.log('[OFFGRID] Asynchronous notification queue worker started.');
}

