import express from 'express';
import { all, get, insert, run, update, remove, now } from '../db.js';
import { requireAuth, requireCapability } from '../auth.js';
import { can, hashPassword, randomToken } from '../security.js';
import { serializeRow, serializeRows } from '../serialize.js';
import { publish, notify } from '../bus.js';
import { activity } from '../db.js';

const TEAM_TYPES = ['Water Rescue', 'Medical Response', 'Fire & Rescue', 'Urban Search & Rescue', 'Drone Surveillance', 'Evacuation & Relief', 'Power & Utilities', 'Hazmat'];
const STATUSES = {
  teams: ['available', 'deployed', 'standby', 'offline'],
  hospitals: ['operational', 'limited', 'full', 'offline'],
  resources: ['available', 'low', 'reserved', 'unavailable'],
  broadcasts: ['draft', 'sent', 'archived'],
  users: ['active', 'suspended', 'inactive'],
};
const ZONES = ['Central Chennai', 'North Chennai', 'South Chennai', 'West Chennai', 'East Coast', 'Industrial Belt', 'Suburban South'];

/**
 * Field definitions drive validation, coercion and CRUD forms on the client.
 * `column` maps a friendly payload key onto the persisted column name.
 */
const CONFIGS = {
  teams: {
    capability: 'team:manage', entity: 'teams', order: 'name ASC',
    fields: {
      name: { type: 'string', required: true, max: 140 },
      code: { type: 'string', max: 30 },
      type: { type: 'string', required: true, options: TEAM_TYPES },
      zone: { type: 'string', options: ZONES },
      leader_name: { type: 'string', max: 120 },
      status: { type: 'string', options: STATUSES.teams, default: 'available' },
      capacity: { type: 'int', min: 1, max: 100, default: 4 },
      members: { type: 'int', min: 0, max: 500, default: 0 },
      latitude: { type: 'float', default: 13.072 },
      longitude: { type: 'float', default: 80.251 },
      contact: { type: 'string', max: 60 },
      skills: { type: 'json', column: 'skills_json', default: [] },
      equipment: { type: 'json', column: 'equipment_json', default: [] },
    },
  },
  hospitals: {
    capability: 'hospital:manage', entity: 'hospitals', order: 'name ASC',
    fields: {
      name: { type: 'string', required: true, max: 160 },
      code: { type: 'string', max: 30 },
      zone: { type: 'string', options: ZONES },
      address: { type: 'string', max: 220 },
      latitude: { type: 'float', default: 13.072 },
      longitude: { type: 'float', default: 80.251 },
      beds_total: { type: 'int', min: 0, max: 10000, default: 0 },
      beds_available: { type: 'int', min: 0, max: 10000, default: 0 },
      icu_total: { type: 'int', min: 0, max: 2000, default: 0 },
      icu_available: { type: 'int', min: 0, max: 2000, default: 0 },
      oxygen_units: { type: 'int', min: 0, max: 100000, default: 0 },
      ambulances: { type: 'int', min: 0, max: 500, default: 0 },
      trauma_level: { type: 'string', max: 60 },
      status: { type: 'string', options: STATUSES.hospitals, default: 'operational' },
      contact: { type: 'string', max: 60 },
      blood_units: { type: 'json', column: 'blood_units_json', default: {} },
    },
  },
  resources: {
    capability: 'resource:manage', entity: 'resources', order: 'name ASC',
    fields: {
      name: { type: 'string', required: true, max: 140 },
      category: { type: 'string', max: 80 },
      quantity: { type: 'int', min: 0, max: 1000000, default: 0 },
      unit: { type: 'string', max: 30, default: 'units' },
      threshold: { type: 'int', min: 0, max: 1000000, default: 0 },
      zone: { type: 'string', options: ZONES },
      supplier: { type: 'string', max: 120 },
      status: { type: 'string', options: STATUSES.resources, default: 'available' },
    },
  },
  broadcasts: {
    capability: 'broadcast:manage', entity: 'broadcasts', order: 'created_at DESC',
    fields: {
      title: { type: 'string', required: true, max: 160 },
      body: { type: 'string', required: true, max: 2000 },
      level: { type: 'string', options: ['advisory', 'warning', 'critical'], default: 'advisory' },
      status: { type: 'string', options: STATUSES.broadcasts, default: 'sent' },
      recipients: { type: 'int', min: 0, max: 10000000, default: 0 },
      zones: { type: 'json', column: 'zones_json', default: [] },
      channels: { type: 'json', column: 'channels_json', default: ['app', 'sms'] },
    },
  },
  users: {
    capability: 'user:manage', entity: 'users', order: 'name ASC', readCapability: 'user:view',
    fields: {
      name: { type: 'string', required: true, max: 120 },
      email: { type: 'email', required: true, max: 160 },
      phone: { type: 'string', max: 40 },
      role: { type: 'string', required: true, options: ['citizen', 'responder', 'authority', 'hospital', 'medical', 'admin'] },
      zone: { type: 'string', options: ZONES },
      designation: { type: 'string', max: 160 },
      status: { type: 'string', options: STATUSES.users, default: 'active' },
      team_id: { type: 'int', nullable: true },
      password: { type: 'password', column: 'password_hash' },
    },
  },
};

function coerce(spec, value) {
  if (spec.type === 'int') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, parsed));
  }
  if (spec.type === 'float') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (spec.type === 'json') {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return Array.isArray(spec.default) ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : {}; }
    }
    return value ?? spec.default;
  }
  if (spec.type === 'password') return String(value).length >= 6 ? hashPassword(String(value)) : null;
  const string = String(value ?? '').trim().slice(0, spec.max || 240);
  if (spec.type === 'email') return string.toLowerCase();
  if (spec.options && !spec.options.includes(string)) return null;
  return string;
}

function buildPayload(config, body, isCreate) {
  const data = {};
  const errors = [];
  for (const [key, spec] of Object.entries(config.fields)) {
    const column = spec.column || key;
    const hasValue = body?.[key] !== undefined && body[key] !== '';
    if (!hasValue) {
      if (isCreate && spec.required) errors.push(`${key.replace(/_/g, ' ')} is required`);
      else if (isCreate && spec.default !== undefined) data[column] = spec.type === 'json' ? JSON.stringify(spec.default) : spec.default;
      continue;
    }
    if (body[key] === null && spec.nullable) {
      data[column] = null;
      continue;
    }
    const value = coerce(spec, body[key]);
    if (value === null || (spec.options && !spec.options.includes(value))) {
      errors.push(`${key.replace(/_/g, ' ')} is invalid`);
      continue;
    }
    data[column] = spec.type === 'json' ? JSON.stringify(value) : value;
  }
  if (isCreate && data.beds_available !== undefined && Number(data.beds_available) > Number(data.beds_total ?? 999999)) {
    errors.push('available beds cannot exceed total beds');
  }
  return { data, errors };
}

function afterWrite(table, action, row, actorName) {
  const label = (row.name || row.title || row.code || `#${row.id}`);
  activity(
    table === 'broadcasts' ? 'broadcast' : table.slice(0, -1),
    `${action === 'create' ? 'Created' : action === 'update' ? 'Updated' : 'Removed'} ${table.slice(0, -1)}`,
    String(label),
    actorName,
  );
  publish('sync', { entity: table, action, id: row.id });
  publish('sync', { entity: 'activity', action: 'refresh' });
  if (table === 'resources' && Number(row.quantity) <= Number(row.threshold)) {
    notify('Low stock alert', `${row.name}: ${row.quantity} ${row.unit} remaining`, 'warning');
  }
  if (table === 'broadcasts' && action === 'create' && row.status === 'sent') {
    notify('Broadcast sent', row.title, row.level === 'critical' ? 'critical' : 'info');
  }
}

export function collectionRouter(table) {
  const config = CONFIGS[table];
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    if (config.readCapability && !can(req.user.role, config.readCapability)) {
      return res.status(403).json({ error: 'You do not have permission to view this resource.' });
    }
    const clauses = [];
    const params = [];
    if (table === 'broadcasts' && !can(req.user.role, 'broadcast:manage')) clauses.push("status = 'sent'");
    for (const key of ['status', 'zone', 'type', 'category', 'level', 'role']) {
      if (req.query[key] && req.query[key] !== 'all') {
        clauses.push(`${key} = ?`);
        params.push(String(req.query[key]));
      }
    }
    if (req.query.q) {
      const q = `%${String(req.query.q).toLowerCase()}%`;
      const columns = table === 'broadcasts' ? 'title, body' : table === 'users' ? 'name, email, designation' : 'name, code, zone';
      clauses.push(`(${columns.split(', ').map((col) => `lower(${col}) LIKE ?`).join(' OR ')})`);
      params.push(...columns.split(', ').map(() => q));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = all(`SELECT * FROM ${table} ${where} ORDER BY ${config.order} LIMIT 500`, params);
    res.json({ [table]: serializeRows(table, rows), total: rows.length });
  });

  router.get('/:id', (req, res) => {
    if (config.readCapability && !can(req.user.role, config.readCapability)) {
      return res.status(403).json({ error: 'You do not have permission to view this resource.' });
    }
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Record not found.' });
    res.json({ [table.slice(0, -1)]: serializeRow(table, row) });
  });

  router.post('/', requireCapability(config.capability), (req, res) => {
    const { data, errors } = buildPayload(config, req.body || {}, true);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (table === 'users' && get('SELECT id FROM users WHERE lower(email) = ?', [data.email])) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (table === 'users' && !data.password_hash) data.password_hash = hashPassword('Demo@123');
    if (table === 'broadcasts') {
      data.author_name = req.user.name;
      data.created_at = now();
      if (data.status === 'sent' && !Number(data.recipients)) data.recipients = Math.round(6000 + Math.random() * 14000);
    }
    if (table === 'teams') data.created_at = now();
    if (table === 'users') {
      data.created_at = now();
      data.last_active_at = now();
      data.avatar_color = '#3b7ff5';
    }
    if (['hospitals', 'resources'].includes(table)) data.updated_at = now();
    const id = insert(table, data);
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    afterWrite(table, 'create', row, req.user.name);
    res.status(201).json({ [table.slice(0, -1)]: serializeRow(table, row) });
  });

  router.patch('/:id', requireCapability(config.capability), (req, res) => {
    const existing = get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Record not found.' });
    const { data, errors } = buildPayload(config, req.body || {}, false);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (table === 'users' && data.email && get('SELECT id FROM users WHERE lower(email) = ? AND id <> ?', [data.email, existing.id])) {
      return res.status(409).json({ error: 'Email is already in use.' });
    }
    if (table === 'users' && Number(existing.id) === Number(req.user.id) && data.status && data.status !== 'active') {
      return res.status(400).json({ error: 'You cannot suspend your own account.' });
    }
    if (['hospitals', 'resources'].includes(table)) data.updated_at = now();
    if (!Object.keys(data).length) return res.json({ [table.slice(0, -1)]: serializeRow(table, existing) });
    update(table, existing.id, data);
    const row = get(`SELECT * FROM ${table} WHERE id = ?`, [existing.id]);
    afterWrite(table, 'update', row, req.user.name);
    res.json({ [table.slice(0, -1)]: serializeRow(table, row) });
  });

  router.delete('/:id', requireCapability(config.capability), (req, res) => {
    const existing = get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Record not found.' });
    if (table === 'users') {
      if (Number(existing.id) === Number(req.user.id)) return res.status(400).json({ error: 'You cannot delete your own account.' });
      if (existing.role === 'admin' && get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'").count <= 1) {
        return res.status(400).json({ error: 'At least one active administrator is required.' });
      }
      run('DELETE FROM sessions WHERE user_id = ?', [existing.id]);
    }
    if (table === 'teams') {
      run('UPDATE incidents SET assigned_team_id = NULL WHERE assigned_team_id = ?', [existing.id]);
      run('UPDATE users SET team_id = NULL WHERE team_id = ?', [existing.id]);
    }
    if (table === 'hospitals') run('UPDATE incidents SET assigned_hospital_id = NULL WHERE assigned_hospital_id = ?', [existing.id]);
    remove(table, existing.id);
    afterWrite(table, 'delete', existing, req.user.name);
    if (table === 'teams') {
      run(`UPDATE teams SET active_incidents = (SELECT COUNT(*) FROM incidents WHERE incidents.assigned_team_id = teams.id AND incidents.status IN ('assigned','in_progress'))`);
      publish('sync', { entity: 'incidents', action: 'refresh' });
    }
    res.json({ ok: true });
  });

  return router;
}

export const COLLECTION_CONFIGS = CONFIGS;
export const COLLECTION_OPTIONS = { TEAM_TYPES, STATUSES, ZONES };
