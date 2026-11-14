import { all, get, run, insert, update, now } from '../db.js';
import { publish, notify } from '../bus.js';

let escalationSweepInterval = null;

/**
 * Initiates escalation tracking for an emergency incident (especially SOS or S5).
 */
export function startEscalationTracking(incidentId, initialTeam = null) {
  const existing = get(
    "SELECT * FROM notification_escalations WHERE incident_id = ? AND status = 'active'",
    [incidentId],
  );
  if (existing) return existing;

  const incident = get('SELECT * FROM incidents WHERE id = ?', [incidentId]);
  if (!incident) return null;

  const stage1Threshold = Number(process.env.ESCALATION_STAGE1_MINUTES || 3);
  const targetRole = initialTeam ? 'responder' : 'authority';
  const targetName = initialTeam ? initialTeam.name : 'Regional Dispatch';
  const targetId = initialTeam ? initialTeam.id : null;

  const history = [
    {
      stage: 1,
      targetRole,
      targetName,
      triggeredAt: now(),
      reason: 'Emergency incident logged / SOS activated.',
    },
  ];

  const escalationId = insert('notification_escalations', {
    incident_id: incidentId,
    stage: 1,
    status: 'active',
    current_target_role: targetRole,
    current_target_name: targetName,
    current_target_id: targetId,
    threshold_minutes: stage1Threshold,
    triggered_at: now(),
    escalated_at: now(),
    acknowledged_at: null,
    notes: `Initial Stage 1 notification dispatched to ${targetName}.`,
    history_json: JSON.stringify(history),
  });

  return get('SELECT * FROM notification_escalations WHERE id = ?', [escalationId]);
}

/**
 * Acknowledges or resolves an escalation, cancelling further stages.
 */
export function cancelOrAcknowledgeEscalation(incidentId, status = 'acknowledged', actorName = 'Field Responder') {
  const activeList = all(
    "SELECT * FROM notification_escalations WHERE incident_id = ? AND status = 'active'",
    [incidentId],
  );

  for (const esc of activeList) {
    let history = [];
    try { history = JSON.parse(esc.history_json || '[]'); } catch { history = []; }
    history.push({
      action: status,
      by: actorName,
      at: now(),
      stage: esc.stage,
    });

    update('notification_escalations', esc.id, {
      status,
      acknowledged_at: now(),
      notes: `Escalation ${status} by ${actorName}. Automated escalation halted.`,
      history_json: JSON.stringify(history),
    });

    publish('sync', { entity: 'notification_escalations', action: 'update', id: esc.id });
  }
}

/**
 * Manually advances an escalation to the next stage by authorized operator.
 */
export function triggerManualEscalation(escalationId, operatorName = 'Command Operator', note = 'Manual escalation invoked') {
  const esc = get('SELECT * FROM notification_escalations WHERE id = ?', [escalationId]);
  if (!esc) throw new Error('Escalation record not found.');
  if (esc.status !== 'active') throw new Error(`Escalation is currently ${esc.status} and cannot be escalated.`);

  const nextStage = Math.min(4, esc.stage + 1);
  return advanceEscalation(esc, nextStage, `Manual escalation triggered by ${operatorName}: ${note}`);
}

/**
 * Advances an escalation to the next tier and triggers notifications.
 */
export async function advanceEscalation(esc, nextStage, reason) {
  const incident = get('SELECT * FROM incidents WHERE id = ?', [esc.incident_id]);
  if (!incident) return;

  let targetRole = 'authority';
  let targetName = 'Regional Coordination Officer';
  let thresholdMinutes = 7;

  if (nextStage === 2) {
    targetRole = 'authority';
    targetName = `Zonal Coordinator (${incident.zone || 'Central'})`;
    thresholdMinutes = Number(process.env.ESCALATION_STAGE2_MINUTES || 7);
  } else if (nextStage === 3) {
    targetRole = 'admin';
    targetName = 'Platform Administrator & Backup Units';
    thresholdMinutes = Number(process.env.ESCALATION_STAGE3_MINUTES || 15);
  } else if (nextStage === 4) {
    targetRole = 'high_command';
    targetName = 'Emergency High Command';
    thresholdMinutes = Number(process.env.ESCALATION_STAGE4_MINUTES || 30);
  }

  let history = [];
  try { history = JSON.parse(esc.history_json || '[]'); } catch { history = []; }
  history.push({
    stage: nextStage,
    fromStage: esc.stage,
    targetRole,
    targetName,
    triggeredAt: now(),
    reason,
  });

  update('notification_escalations', esc.id, {
    stage: nextStage,
    current_target_role: targetRole,
    current_target_name: targetName,
    threshold_minutes: thresholdMinutes,
    escalated_at: now(),
    notes: reason,
    history_json: JSON.stringify(history),
  });

  // Note on incident
  const row = get('SELECT notes_json FROM incidents WHERE id = ?', [incident.id]);
  const notes = (() => {
    try { return JSON.parse(row?.notes_json || '[]'); } catch { return []; }
  })();
  notes.push({ at: now(), text: `[ESCALATION STAGE ${nextStage}] ${reason}`, author: 'OFFGRID Escalation Engine' });
  run('UPDATE incidents SET notes_json = ? WHERE id = ?', [JSON.stringify(notes.slice(-40)), incident.id]);

  // Dispatch multi-channel alert
  notify(`Emergency Escalated (Stage ${nextStage})`, `${incident.code} escalated to ${targetRole}. Action needed.`, 'critical', `/incidents?open=${incident.id}`);
  publish('sync', { entity: 'notification_escalations', action: 'update', id: esc.id });
  publish('sync', { entity: 'incidents', action: 'update', id: incident.id });

  // Import dispatcher lazily to prevent circular dependencies
  const { dispatchNotificationEvent } = await import('./dispatcher.js');
  await dispatchNotificationEvent('escalation_triggered', {
    incident,
    stage: nextStage,
    targetRole,
    targetName,
    reason,
    thresholdMinutes,
  });
}

/**
 * Periodic automated check to advance unacknowledged critical emergencies.
 */
export async function runEscalationSweep() {
  try {
    const activeEscalations = all("SELECT * FROM notification_escalations WHERE status = 'active'");
    for (const esc of activeEscalations) {
      const incident = get('SELECT * FROM incidents WHERE id = ?', [esc.incident_id]);
      if (!incident) continue;

      // If incident was acknowledged or resolved, cancel active escalation
      if (['resolved', 'closed', 'duplicate'].includes(incident.status) || incident.acknowledged_at) {
        cancelOrAcknowledgeEscalation(incident.id, incident.status === 'resolved' ? 'resolved' : 'acknowledged', 'System Sync');
        continue;
      }

      // Compute elapsed minutes since last escalation
      const lastEscalated = new Date(esc.escalated_at || esc.triggered_at).getTime();
      const elapsedMinutes = (Date.now() - lastEscalated) / 60000;

      if (elapsedMinutes >= esc.threshold_minutes && esc.stage < 4) {
        const nextStage = esc.stage + 1;
        await advanceEscalation(
          esc,
          nextStage,
          `Automated escalation: Incident remained unacknowledged after ${Math.round(elapsedMinutes)} minutes at Stage ${esc.stage}.`,
        );
      }
    }
  } catch (error) {
    console.error('[Escalation Engine Sweep]', error);
  }
}

/**
 * Starts background sweep timer for automatic escalations.
 */
export function startEscalationEngine() {
  if (escalationSweepInterval) return;
  escalationSweepInterval = setInterval(() => {
    runEscalationSweep().catch((err) => console.error('[Escalation Sweep Error]', err));
  }, 25000);
  escalationSweepInterval.unref?.();
  console.log('[OFFGRID] Automated emergency escalation engine started.');
}

