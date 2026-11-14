import express from 'express';
import { all, get, insert, run, update, remove, now } from '../db.js';
import { requireAuth, requireCapability } from '../auth.js';
import { can } from '../security.js';
import { classifyIncident, computePriority, detectDuplicate, allocateTeams, categoryLabel } from '../ai.js';
import { serializeRow, serializeRows } from '../serialize.js';
import { publish, notify } from '../bus.js';
import { activity } from '../db.js';
import { dispatchNotificationEvent } from '../notifications/dispatcher.js';
import { cancelOrAcknowledgeEscalation } from '../notifications/escalation.js';

const ACTIVE_STATUSES = ['pending', 'triaged', 'assigned', 'in_progress'];
const ZONE_CENTERS = {
  'Central Chennai': [13.072, 80.251],
  'North Chennai': [13.112, 80.245],
  'South Chennai': [13.015, 80.235],
  'West Chennai': [13.062, 80.195],
  'East Coast': [13.055, 80.285],
  'Industrial Belt': [13.128, 80.285],
  'Suburban South': [12.965, 80.215],
};

function broadcastChange(action, id, extra = {}) {
  publish('sync', { entity: 'incidents', action, id, ...extra });
  publish('sync', { entity: 'activity', action: 'refresh' });
  publish('sync', { entity: 'notifications', action: 'refresh' });
}

function syncTeamLoads() {
  run(`
    UPDATE teams SET active_incidents = (
      SELECT COUNT(*) FROM incidents
      WHERE incidents.assigned_team_id = teams.id
        AND incidents.status IN ('assigned','in_progress')
    )
  `);
  run("UPDATE teams SET status = 'deployed' WHERE active_incidents > 0 AND status <> 'offline'");
  run("UPDATE teams SET status = 'available' WHERE active_incidents = 0 AND status = 'deployed'");
  publish('sync', { entity: 'teams', action: 'refresh' });
}

function addNote(id, text, author = 'OFFGRID System') {
  const row = get('SELECT notes_json FROM incidents WHERE id = ?', [id]);
  const notes = (() => {
    try { return JSON.parse(row?.notes_json || '[]'); } catch { return []; }
  })();
  notes.push({ at: now(), text, author });
  run('UPDATE incidents SET notes_json = ? WHERE id = ?', [JSON.stringify(notes.slice(-40)), id]);
}

function systemMessage(incidentId, body, actorName = 'OFFGRID System') {
  insert('messages', {
    incident_id: incidentId, user_id: null, author_name: actorName, author_role: 'system',
    body, kind: 'system', created_at: now(),
  });
  publish('message', { incidentId, body, authorName: actorName, createdAt: now() });
}

function visibleToUser(req, incident) {
  if (!incident) return false;
  if (can(req.user.role, 'all:view')) return true;
  return incident.reporter_id === req.user.id;
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function incidentsRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const clauses = [];
    const params = [];
    if (!can(req.user.role, 'all:view')) {
      clauses.push('reporter_id = ?');
      params.push(req.user.id);
    }
    for (const [queryKey, column] of Object.entries({ status: 'status', category: 'category', zone: 'zone', source: 'source', severity: 'severity', assigned_team_id: 'assigned_team_id' })) {
      const value = req.query[queryKey];
      if (value && value !== 'all') {
        if (value.startsWith('!')) {
          clauses.push(`${column} <> ?`);
          params.push(value.slice(1));
        } else {
          clauses.push(`${column} = ?`);
          params.push(value);
        }
      }
    }
    if (req.query.q) {
      const term = `%${String(req.query.q).toLowerCase()}%`;
      clauses.push('(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(code) LIKE ? OR lower(address) LIKE ?)');
      params.push(term, term, term, term);
    }
    if (req.query.mine === 'true') {
      clauses.push('reporter_id = ?');
      params.push(req.user.id);
    }
    if (req.query.duplicates === 'true') clauses.push('duplicate_of IS NOT NULL');
    if (req.query.active === 'true') {
      clauses.push(`status IN (${ACTIVE_STATUSES.map(() => '?').join(', ')})`);
      params.push(...ACTIVE_STATUSES);
    }
    const limit = Math.min(500, Math.max(1, numeric(req.query.limit, 300)));
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = all(
      `SELECT * FROM incidents ${where}
       ORDER BY CASE WHEN status IN ('resolved','closed','duplicate') THEN 1 ELSE 0 END,
                priority_score DESC, created_at DESC LIMIT ?`,
      [...params, limit],
    );
    res.json({ incidents: serializeRows('incidents', rows), total: rows.length });
  });

  router.get('/:id', (req, res) => {
    const row = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!visibleToUser(req, row)) return res.status(404).json({ error: 'Incident not found.' });
    res.json({ incident: serializeRow('incidents', row) });
  });

  router.get('/:id/messages', (req, res) => {
    const row = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!visibleToUser(req, row)) return res.status(404).json({ error: 'Incident not found.' });
    const rows = all('SELECT * FROM messages WHERE incident_id = ? ORDER BY created_at ASC, id ASC LIMIT 300', [req.params.id]);
    res.json({ messages: rows });
  });

  router.post('/:id/messages', (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!visibleToUser(req, incident)) return res.status(404).json({ error: 'Incident not found.' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty.' });
    const id = insert('messages', {
      incident_id: incident.id, user_id: req.user.id, author_name: req.user.name,
      author_role: req.user.role, body: body.slice(0, 1200), kind: req.body?.kind || 'text', created_at: now(),
    });
    const message = get('SELECT * FROM messages WHERE id = ?', [id]);
    publish('message', { incidentId: incident.id, message });
    publish('sync', { entity: 'messages', action: 'create', id, incidentId: incident.id });
    res.status(201).json({ message });
  });

  router.delete('/:id/messages/:messageId', requireCapability('message:delete'), (req, res) => {
    remove('messages', req.params.messageId);
    publish('sync', { entity: 'messages', action: 'delete', id: Number(req.params.messageId), incidentId: Number(req.params.id) });
    res.json({ ok: true });
  });

  router.get('/:id/recommendations', (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!visibleToUser(req, incident)) return res.status(404).json({ error: 'Incident not found.' });
    const teams = serializeRows('teams', all('SELECT * FROM teams'));
    res.json({ recommendations: allocateTeams(serializeRow('incidents', incident), teams) });
  });

  router.post('/', (req, res) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (title.length < 4) return res.status(400).json({ error: 'Give the report a short title (at least 4 characters).' });
    const source = ['sos', 'web', 'mobile', 'offline', 'sensor', 'call'].includes(body.source) ? body.source : 'web';
    const zone = String(body.zone || req.user.zone || 'Central Chennai');
    const center = ZONE_CENTERS[zone] || ZONE_CENTERS['Central Chennai'];
    const candidate = {
      title,
      description: String(body.description || '').trim().slice(0, 2000),
      source,
      people_affected: numeric(body.people_affected, 0),
      vulnerable_count: numeric(body.vulnerable_count, 0),
    };
    const classification = classifyIncident(candidate);
    const openIncidents = all("SELECT * FROM incidents WHERE status NOT IN ('resolved','closed','duplicate') AND created_at > ?", [new Date(Date.now() - 3 * 3600000).toISOString()]);
    const duplicate = detectDuplicate(
      { ...candidate, category: classification.category, latitude: numeric(body.latitude, center[0]), longitude: numeric(body.longitude, center[1]), created_at: now() },
      openIncidents,
    );
    const autoAllocate = get("SELECT value FROM settings WHERE key = 'auto_allocate'")?.value !== 'false';
    const recommendations = allocateTeams({ ...candidate, ...classification, latitude: numeric(body.latitude, center[0]), longitude: numeric(body.longitude, center[1]) }, serializeRows('teams', all('SELECT * FROM teams')));
    let assignedTeamId = null;
    let status = 'pending';
    if (autoAllocate && !duplicate && recommendations.length && (classification.severity >= 5 || source === 'sos')) {
      assignedTeamId = recommendations[0].id;
      status = 'assigned';
    }

    const code = `OG-26-${String(Date.now()).slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const timestamp = now();
    const record = {
      code,
      title: title.slice(0, 180),
      description: candidate.description,
      category: body.category && categoryLabel(body.category) !== 'Other / Unclassified' ? body.category : classification.category,
      severity: classification.severity,
      priority_score: 0,
      status,
      source,
      reporter_id: req.user.id,
      reporter_name: req.user.name,
      reporter_phone: String(body.reporter_phone || req.user.phone || '').slice(0, 40),
      latitude: numeric(body.latitude, center[0]),
      longitude: numeric(body.longitude, center[1]),
      address: String(body.address || '').slice(0, 200) || 'Location shared via GPS',
      zone,
      people_affected: candidate.people_affected,
      vulnerable_count: candidate.vulnerable_count,
      ai_confidence: classification.confidence,
      ai_reasoning_json: JSON.stringify(classification.reasoning),
      tags_json: JSON.stringify(classification.tags),
      duplicate_of: duplicate?.id || null,
      duplicate_score: duplicate?.score || null,
      assigned_team_id: assignedTeamId,
      assigned_hospital_id: null,
      live_location: Boolean(body.live_location),
      offline_synced: Boolean(body.offline_synced),
      sla_minutes: classification.slaMinutes,
      notes_json: JSON.stringify([{ at: timestamp, text: `Report received via ${source.toUpperCase()}${Boolean(body.offline_synced) ? ' after offline sync' : ''}.`, author: 'OFFGRID System' }]),
      created_at: timestamp,
      updated_at: timestamp,
      acknowledged_at: status === 'assigned' ? timestamp : null,
      resolved_at: null,
    };
    record.priority_score = computePriority(record);
    const id = insert('incidents', record);
    const incident = serializeRow('incidents', get('SELECT * FROM incidents WHERE id = ?', [id]));

    systemMessage(id, `AI classified this report as ${incident.category_label} · severity S${incident.severity} · confidence ${Math.round(classification.confidence * 100)}%.`);
    if (duplicate) {
      systemMessage(id, `Possible duplicate of ${duplicate.code} detected (${Math.round(duplicate.score * 100)}% match). Flagged for operator review.`);
      notify('Possible duplicate detected', `${incident.code} overlaps with ${duplicate.code}`, 'warning');
    }
    if (assignedTeamId) {
      const team = get('SELECT * FROM teams WHERE id = ?', [assignedTeamId]);
      systemMessage(id, `Auto-allocated ${team.name} — ${team.type}, ETA ${recommendations[0].etaMinutes} min.`);
      addNote(id, `Auto-allocated ${team.code} (${team.type}).`, 'OFFGRID AI');
      notify('Critical SOS auto-allocated', `${team.code} dispatched to ${incident.code}`, 'critical');
    }
    if (classification.severity >= 4) {
      notify('High-priority incident received', `${incident.code} · ${incident.title}`, 'critical');
    }

    // Enterprise Multi-Channel Emergency Dispatch
    if (source === 'sos') {
      dispatchNotificationEvent('sos_activated', {
        incident,
        nearestTeam: recommendations[0] || null,
        coordinates: { latitude: incident.latitude, longitude: incident.longitude },
        sosId: incident.code,
      }, { actorId: req.user.id, actorName: req.user.name }).catch((e) => console.error('[SOS Dispatch]', e));
    } else if (classification.severity >= 5) {
      dispatchNotificationEvent('critical_detected', {
        incident,
        classification,
      }, { actorId: req.user.id, actorName: req.user.name }).catch((e) => console.error('[Critical Dispatch]', e));
    } else {
      dispatchNotificationEvent('incident_new', {
        incident,
      }, { actorId: req.user.id, actorName: req.user.name }).catch((e) => console.error('[Incident Dispatch]', e));
    }

    if (duplicate) {
      dispatchNotificationEvent('duplicate_detected', {
        incident,
        primaryIncident: duplicate,
        score: duplicate.score,
      }).catch((e) => console.error('[Duplicate Dispatch]', e));
    }

    if (assignedTeamId) {
      const team = get('SELECT * FROM teams WHERE id = ?', [assignedTeamId]);
      if (team) {
        dispatchNotificationEvent('team_assigned', {
          incident,
          team,
          etaMinutes: recommendations[0]?.etaMinutes || 15,
        }).catch((e) => console.error('[Team Assign Dispatch]', e));
      }
    }

    activity('incident', 'New incident reported', `${incident.code} · ${incident.title}`, req.user.name, 'incident', id);
    syncTeamLoads();
    broadcastChange('create', id, { incident });
    res.status(201).json({ incident, classification, duplicate, recommendations: recommendations.slice(0, 3) });
  });

  router.patch('/:id', (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    const isOwner = incident.reporter_id === req.user.id;
    const canUpdate = can(req.user.role, 'incident:update');
    if (!canUpdate && !(isOwner && ACTIVE_STATUSES.slice(0, 2).includes(incident.status))) {
      return res.status(403).json({ error: 'You cannot modify this incident.' });
    }
    const body = req.body || {};
    const allowed = [
      'title', 'description', 'category', 'severity', 'priority_score', 'status', 'address', 'zone',
      'latitude', 'longitude', 'people_affected', 'vulnerable_count', 'live_location',
      'assigned_team_id', 'assigned_hospital_id', 'duplicate_of', 'sla_minutes', 'source',
    ];
    const changes = {};
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      if (['severity', 'priority_score', 'people_affected', 'vulnerable_count', 'sla_minutes', 'assigned_team_id', 'assigned_hospital_id', 'duplicate_of'].includes(key)) {
        changes[key] = body[key] === null ? null : numeric(body[key], 0);
      } else if (['latitude', 'longitude'].includes(key)) {
        changes[key] = numeric(body[key], incident[key]);
      } else if (key === 'live_location') {
        changes[key] = Boolean(body[key]);
      } else {
        changes[key] = String(body[key]).trim().slice(0, key === 'description' ? 2000 : 220);
      }
    }
    if (changes.severity !== undefined) changes.severity = Math.min(5, Math.max(1, Math.round(changes.severity)));
    if (changes.status && !['pending', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed', 'duplicate'].includes(changes.status)) {
      return res.status(400).json({ error: 'Invalid incident status.' });
    }
    const nextStatus = changes.status || incident.status;
    if (nextStatus === 'assigned' || nextStatus === 'in_progress') {
      if (!incident.acknowledged_at) changes.acknowledged_at = now();
    }
    if (['resolved', 'closed'].includes(nextStatus) && !['resolved', 'closed'].includes(incident.status)) {
      changes.resolved_at = now();
      changes.status = nextStatus;
    }
    if (['resolved', 'closed', 'duplicate'].includes(incident.status) && ACTIVE_STATUSES.includes(nextStatus)) {
      changes.resolved_at = null;
    }
    if (changes.assigned_team_id && !get('SELECT id FROM teams WHERE id = ?', [changes.assigned_team_id])) {
      return res.status(400).json({ error: 'Selected team does not exist.' });
    }
    if (body.recompute_priority === true || changes.severity !== undefined) {
      changes.priority_score = computePriority({ ...incident, ...changes });
    }
    changes.updated_at = now();
    update('incidents', incident.id, changes);

    if (changes.status && changes.status !== incident.status) {
      const label = changes.status.replace('_', ' ');
      systemMessage(incident.id, `Status changed from ${incident.status.replace('_', ' ')} to ${label}.`, req.user.name);
      addNote(incident.id, `Status → ${label}.`, req.user.name);
      activity('status', `Incident ${label}`, `${incident.code} · ${incident.title}`, req.user.name, 'incident', incident.id);

      if (['resolved', 'closed'].includes(changes.status)) {
        cancelOrAcknowledgeEscalation(incident.id, 'resolved', req.user.name);
        dispatchNotificationEvent('incident_resolved', {
          incident: { ...incident, ...changes },
          resolvedBy: req.user.name,
        }).catch((e) => console.error('[Resolved Dispatch]', e));
      } else {
        if (changes.status === 'in_progress' || changes.status === 'assigned') {
          cancelOrAcknowledgeEscalation(incident.id, 'acknowledged', req.user.name);
        }
        dispatchNotificationEvent('status_changed', {
          incident: { ...incident, ...changes },
          oldStatus: incident.status,
          newStatus: changes.status,
          actorName: req.user.name,
        }).catch((e) => console.error('[Status Dispatch]', e));
      }
    }
    if (changes.assigned_team_id !== undefined && changes.assigned_team_id !== incident.assigned_team_id) {
      const newTeam = changes.assigned_team_id ? get('SELECT * FROM teams WHERE id = ?', [changes.assigned_team_id]) : null;
      const previousTeam = incident.assigned_team_id ? get('SELECT * FROM teams WHERE id = ?', [incident.assigned_team_id]) : null;
      systemMessage(incident.id, newTeam ? `${newTeam.name} assigned to this incident.` : 'Team assignment cleared.', req.user.name);
      addNote(incident.id, newTeam ? `Assigned ${newTeam.code}.` : 'Team assignment cleared.', req.user.name);

      if (newTeam) {
        cancelOrAcknowledgeEscalation(incident.id, 'acknowledged', req.user.name);
        dispatchNotificationEvent(previousTeam ? 'team_reassigned' : 'team_assigned', {
          incident: { ...incident, ...changes },
          team: newTeam,
          newTeam,
          previousTeam,
        }).catch((e) => console.error('[Team Reassign Dispatch]', e));
      }
    }
    if (!incident.acknowledged_at && changes.acknowledged_at) {
      cancelOrAcknowledgeEscalation(incident.id, 'acknowledged', req.user.name);
      const ackTeam = (changes.assigned_team_id || incident.assigned_team_id)
        ? get('SELECT * FROM teams WHERE id = ?', [changes.assigned_team_id || incident.assigned_team_id])
        : null;
      if (ackTeam) {
        dispatchNotificationEvent('team_acknowledged', {
          incident: { ...incident, ...changes },
          team: ackTeam,
          acknowledgedBy: req.user.name,
        }).catch((e) => console.error('[Team Ack Dispatch]', e));
      }
    }
    if (body.note) addNote(incident.id, String(body.note).slice(0, 500), req.user.name);
    syncTeamLoads();
    const updated = serializeRow('incidents', get('SELECT * FROM incidents WHERE id = ?', [incident.id]));
    broadcastChange('update', updated.id, { incident: updated });
    res.json({ incident: updated });
  });

  router.delete('/:id', (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    const isOwner = incident.reporter_id === req.user.id;
    if (!can(req.user.role, 'incident:delete') && !(isOwner && incident.status === 'pending')) {
      return res.status(403).json({ error: 'Only authorities or the original reporter can remove this report.' });
    }
    remove('incidents', incident.id);
    activity('delete', 'Incident removed', `${incident.code} · ${incident.title}`, req.user.name);
    syncTeamLoads();
    broadcastChange('delete', incident.id);
    res.json({ ok: true });
  });

  router.post('/:id/allocate', requireCapability('incident:assign'), (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    const teams = serializeRows('teams', all('SELECT * FROM teams'));
    const ranked = allocateTeams(serializeRow('incidents', incident), teams);
    const chosen = req.body?.team_id
      ? ranked.find((team) => team.id === Number(req.body.team_id))
      : ranked[0];
    if (!chosen) return res.status(400).json({ error: 'No available rescue team could be allocated.' });
    update('incidents', incident.id, {
      assigned_team_id: chosen.id,
      status: incident.status === 'pending' || incident.status === 'triaged' ? 'assigned' : incident.status,
      acknowledged_at: incident.acknowledged_at || now(),
      updated_at: now(),
    });
    systemMessage(incident.id, `${chosen.name} allocated · match score ${chosen.score} · ETA ${chosen.etaMinutes} min.`, req.user.name);
    addNote(incident.id, `AI allocation: ${chosen.code} (score ${chosen.score}, ${chosen.distanceKm} km).`, req.user.name);
    activity('allocation', `${chosen.code} allocated`, `${incident.code} · AI score ${chosen.score} · ETA ${chosen.etaMinutes} min`, req.user.name, 'incident', incident.id);
    notify('Rescue team allocated', `${chosen.code} → ${incident.code}`, 'success');
    cancelOrAcknowledgeEscalation(incident.id, 'acknowledged', req.user.name);
    dispatchNotificationEvent('team_assigned', {
      incident: { ...incident, assigned_team_id: chosen.id, status: 'assigned' },
      team: chosen,
      etaMinutes: chosen.etaMinutes || 15,
    }).catch((e) => console.error('[Allocate Dispatch]', e));
    syncTeamLoads();
    const updated = serializeRow('incidents', get('SELECT * FROM incidents WHERE id = ?', [incident.id]));
    broadcastChange('update', updated.id, { incident: updated });
    res.json({ incident: updated, team: chosen, recommendations: ranked.slice(0, 5) });
  });

  router.post('/:id/merge', requireCapability('incident:assign'), (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    const targetId = Number(req.body?.duplicate_of);
    const target = get('SELECT * FROM incidents WHERE id = ?', [targetId]);
    if (!target || target.id === incident.id) return res.status(400).json({ error: 'Choose a valid primary incident.' });
    update('incidents', incident.id, { status: 'duplicate', duplicate_of: target.id, duplicate_score: 1, updated_at: now() });
    systemMessage(incident.id, `Merged into ${target.code} as a duplicate report.`, req.user.name);
    addNote(incident.id, `Merged into ${target.code}.`, req.user.name);
    activity('duplicate', 'Duplicate reports merged', `${incident.code} → ${target.code}`, req.user.name);
    syncTeamLoads();
    const updated = serializeRow('incidents', get('SELECT * FROM incidents WHERE id = ?', [incident.id]));
    broadcastChange('update', updated.id, { incident: updated });
    res.json({ incident: updated });
  });

  router.post('/:id/location', (req, res) => {
    const incident = get('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    if (!visibleToUser(req, incident)) return res.status(404).json({ error: 'Incident not found.' });
    const latitude = numeric(req.body?.latitude, incident.latitude);
    const longitude = numeric(req.body?.longitude, incident.longitude);
    update('incidents', incident.id, { latitude, longitude, updated_at: now() });
    publish('location', { incidentId: incident.id, code: incident.code, latitude, longitude, at: now() });
    res.json({ ok: true, latitude, longitude });
  });

  return router;
}

export function aiRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.post('/classify', (req, res) => {
    const classification = classifyIncident(req.body || {});
    const zone = String(req.body?.zone || 'Central Chennai');
    const center = ZONE_CENTERS[zone] || ZONE_CENTERS['Central Chennai'];
    const candidate = {
      ...req.body,
      category: req.body?.category || classification.category,
      latitude: numeric(req.body?.latitude, center[0]),
      longitude: numeric(req.body?.longitude, center[1]),
    };
    const open = all("SELECT * FROM incidents WHERE status NOT IN ('resolved','closed','duplicate') AND created_at > ?", [new Date(Date.now() - 3 * 3600000).toISOString()]);
    const duplicate = detectDuplicate(candidate, open);
    const teams = serializeRows('teams', all('SELECT * FROM teams'));
    const recommendations = allocateTeams({ ...candidate, ...classification }, teams).slice(0, 3);
    const preview = {
      ...candidate,
      severity: classification.severity,
      category: classification.category,
      created_at: now(),
      source: req.body?.source || 'web',
    };
    res.json({ classification, duplicate, recommendations, priorityPreview: computePriority(preview) });
  });
  return router;
}
