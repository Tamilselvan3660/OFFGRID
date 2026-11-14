import express from 'express';
import { all, get, insert, run, now } from '../db.js';
import { requireAuth, requireCapability } from '../auth.js';
import { can } from '../security.js';
import { buildAnalytics, classifyIncident, computePriority, detectDuplicate, allocateTeams } from '../ai.js';
import { serializeRow, serializeRows } from '../serialize.js';
import { publish, notify, subscribe } from '../bus.js';
import { activity } from '../db.js';
import { dispatchNotificationEvent } from '../notifications/dispatcher.js';

const SIMULATED_SOS = [
  ['SOS beacon: family stranded by rising water', 'SOS beacon triggered. A family is stranded by rising floodwater and cannot leave the building. Two children are with them.', 'flood', 4, 2, 'South Chennai'],
  ['Smoke reported from warehouse loading bay', 'Security staff report thick smoke and flames from a warehouse loading bay. Staff are evacuating, fire rescue requested.', 'fire', 6, 1, 'Industrial Belt'],
  ['Unconscious patient at transit terminal', 'A passenger collapsed at the transit terminal and is unconscious, not breathing normally. CPR is in progress, ambulance needed.', 'medical', 1, 1, 'Central Chennai'],
  ['Sensor alert: sudden water level rise', 'Automated river gauge reports a sudden water level rise near the low-lying settlement. Preventive evacuation may be required.', 'flood', 25, 4, 'North Chennai'],
  ['Wall collapse with people trapped', 'A boundary wall collapsed onto a parked vehicle; witnesses say people may be trapped under debris and rubble.', 'structural', 3, 1, 'West Chennai'],
  ['Live wire down across residential lane', 'A live electrical wire is down across a residential lane after the storm. Residents are avoiding the area.', 'utility', 8, 3, 'East Coast'],
];

export function miscRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/analytics', (req, res) => {
    const incidents = serializeRows('incidents', all('SELECT * FROM incidents'));
    const teams = serializeRows('teams', all('SELECT * FROM teams'));
    const hospitals = serializeRows('hospitals', all('SELECT * FROM hospitals'));
    const broadcasts = serializeRows('broadcasts', all('SELECT * FROM broadcasts'));
    const resources = serializeRows('resources', all('SELECT * FROM resources'));
    const messages = all('SELECT id FROM messages');
    const analytics = buildAnalytics({ incidents, teams, hospitals, broadcasts, resources, messages });
    res.json({ analytics, generatedAt: now() });
  });

  router.get('/activity', (req, res) => {
    res.json({ activity: all('SELECT * FROM activity ORDER BY created_at DESC, id DESC LIMIT 60') });
  });

  router.get('/notifications', (req, res) => {
    const notifications = all('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT 40');
    res.json({
      notifications: serializeRows('notifications', notifications),
      unread: notifications.filter((n) => !n.read).length,
    });
  });

  router.patch('/notifications/:id/read', (req, res) => {
    run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    publish('sync', { entity: 'notifications', action: 'refresh' });
    res.json({ ok: true });
  });

  router.post('/notifications/read-all', (req, res) => {
    run('UPDATE notifications SET read = 1');
    publish('sync', { entity: 'notifications', action: 'refresh' });
    res.json({ ok: true });
  });

  router.get('/settings', (req, res) => {
    const settings = {};
    for (const row of all('SELECT * FROM settings')) settings[row.key] = row.value;
    res.json({ settings });
  });

  router.patch('/settings', requireCapability('analytics:view'), (req, res) => {
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!['simulate_live', 'auto_allocate', 'duplicate_threshold', 'network_name'].includes(key)) continue;
      run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
    }
    publish('sync', { entity: 'settings', action: 'update' });
    const settings = {};
    for (const row of all('SELECT * FROM settings')) settings[row.key] = row.value;
    res.json({ settings });
  });

  router.get('/export/incidents.csv', (req, res) => {
    const rows = all('SELECT * FROM incidents ORDER BY created_at DESC');
    const headers = ['code', 'title', 'category', 'severity', 'priority_score', 'status', 'zone', 'address', 'people_affected', 'source', 'created_at', 'resolved_at'];
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="offgrid-incidents-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });

  router.post('/simulate/sos', (req, res) => {
    const [title, description, category, people, vulnerable, zone] = SIMULATED_SOS[Math.floor(Math.random() * SIMULATED_SOS.length)];
    const center = {
      'Central Chennai': [13.072, 80.251], 'North Chennai': [13.112, 80.245],
      'South Chennai': [13.015, 80.235], 'West Chennai': [13.062, 80.195],
      'East Coast': [13.055, 80.285], 'Industrial Belt': [13.128, 80.285],
      'Suburban South': [12.965, 80.215],
    }[zone];
    const latitude = Number((center[0] + (Math.random() - 0.5) * 0.02).toFixed(5));
    const longitude = Number((center[1] + (Math.random() - 0.5) * 0.02).toFixed(5));
    const classification = classifyIncident({ title, description, people_affected: people, vulnerable_count: vulnerable, source: 'sos' });
    const open = all("SELECT * FROM incidents WHERE status NOT IN ('resolved','closed','duplicate') AND created_at > ?", [new Date(Date.now() - 3 * 3600000).toISOString()]);
    const duplicate = detectDuplicate({ title, description, category: classification.category, latitude, longitude, created_at: now() }, open);
    const recommendations = allocateTeams({ title, description, ...classification, latitude, longitude }, serializeRows('teams', all('SELECT * FROM teams')));
    const timestamp = now();
    const base = {
      code: `OG-26-${Date.now().toString().slice(-6)}`,
      title, description, category: classification.category, severity: classification.severity,
      priority_score: 0, status: 'pending', source: 'sos',
      reporter_id: req.user.id, reporter_name: 'Emergency SOS Beacon', reporter_phone: '112',
      latitude, longitude, address: `Live GPS · ${zone}`, zone,
      people_affected: people, vulnerable_count: vulnerable,
      ai_confidence: classification.confidence, ai_reasoning_json: JSON.stringify(classification.reasoning),
      tags_json: JSON.stringify(classification.tags), duplicate_of: duplicate?.id || null,
      duplicate_score: duplicate?.score || null, assigned_team_id: null, assigned_hospital_id: null,
      live_location: 1, offline_synced: 0, sla_minutes: classification.slaMinutes,
      notes_json: JSON.stringify([{ at: timestamp, text: 'Simulated SOS ingested from the emergency beacon network.', author: 'OFFGRID System' }]),
      created_at: timestamp, updated_at: timestamp, acknowledged_at: null, resolved_at: null,
    };
    base.priority_score = computePriority(base);
    const id = insert('incidents', base);
    insert('messages', {
      incident_id: id, user_id: null, author_name: 'OFFGRID System', author_role: 'system',
      body: `AI classified this SOS as ${classification.categoryLabel} · S${classification.severity} · ${Math.round(classification.confidence * 100)}% confidence.`,
      kind: 'system', created_at: timestamp,
    });
    activity('incident', 'Simulated SOS received', `${base.code} · ${title}`, req.user.name, 'incident', id);
    notify('Incoming SOS', `${base.code} · ${title}`, 'critical');
    publish('sync', { entity: 'incidents', action: 'create', id });
    publish('sync', { entity: 'activity', action: 'refresh' });
    publish('sync', { entity: 'notifications', action: 'refresh' });
    const fullIncident = serializeRow('incidents', get('SELECT * FROM incidents WHERE id = ?', [id]));
    publish('sos', { incident: fullIncident, recommendations: recommendations.slice(0, 3) });

    // Trigger full enterprise notification pipeline for simulated SOS
    dispatchNotificationEvent('sos_activated', {
      incident: fullIncident,
      nearestTeam: recommendations[0] || null,
      coordinates: { latitude, longitude },
      sosId: base.code,
    }, { actorId: req.user.id, actorName: req.user.name }).catch((e) => console.error('[Simulated SOS Dispatch]', e));

    res.status(201).json({ incident: fullIncident });
  });

  return router;
}

/** SSE stream — mounted separately so it can stay open without other middleware. */
export function streamHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const unsubscribe = subscribe(res, req.user?.id || 'anonymous');
  req.on('close', unsubscribe);
}
