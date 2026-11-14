import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { seedDatabase } from './seed.js';

// Works both from the repository checkout and from a bundled standalone build:
// the app root is the current working directory (or OFFGRID_ROOT when set).
const root = path.resolve(process.env.OFFGRID_ROOT || process.cwd());
const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'offgrid.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen',
  zone TEXT,
  team_id INTEGER,
  designation TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  avatar_color TEXT,
  created_at TEXT NOT NULL,
  last_active_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  type TEXT NOT NULL,
  zone TEXT,
  leader_name TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  capacity INTEGER DEFAULT 4,
  members INTEGER DEFAULT 0,
  active_incidents INTEGER DEFAULT 0,
  latitude REAL,
  longitude REAL,
  skills_json TEXT DEFAULT '[]',
  equipment_json TEXT DEFAULT '[]',
  contact TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hospitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  zone TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  beds_total INTEGER DEFAULT 0,
  beds_available INTEGER DEFAULT 0,
  icu_total INTEGER DEFAULT 0,
  icu_available INTEGER DEFAULT 0,
  oxygen_units INTEGER DEFAULT 0,
  blood_units_json TEXT DEFAULT '{}',
  ambulances INTEGER DEFAULT 0,
  trauma_level TEXT,
  status TEXT DEFAULT 'operational',
  contact TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  severity INTEGER DEFAULT 2,
  priority_score INTEGER DEFAULT 20,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'web',
  reporter_id INTEGER,
  reporter_name TEXT,
  reporter_phone TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  zone TEXT,
  people_affected INTEGER DEFAULT 0,
  vulnerable_count INTEGER DEFAULT 0,
  ai_confidence REAL,
  ai_reasoning_json TEXT DEFAULT '[]',
  tags_json TEXT DEFAULT '[]',
  duplicate_of INTEGER,
  duplicate_score REAL,
  assigned_team_id INTEGER,
  assigned_hospital_id INTEGER,
  live_location INTEGER DEFAULT 0,
  offline_synced INTEGER DEFAULT 0,
  sla_minutes INTEGER DEFAULT 20,
  notes_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  user_id INTEGER,
  author_name TEXT,
  author_role TEXT,
  body TEXT NOT NULL,
  kind TEXT DEFAULT 'text',
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'units',
  threshold INTEGER DEFAULT 0,
  zone TEXT,
  supplier TEXT,
  status TEXT DEFAULT 'available',
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT DEFAULT 'advisory',
  zones_json TEXT DEFAULT '[]',
  channels_json TEXT DEFAULT '["app","sms"]',
  author_name TEXT,
  status TEXT DEFAULT 'sent',
  recipients INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,
  title TEXT,
  detail TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  actor_name TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  incident_id INTEGER,
  event_id TEXT,
  category TEXT DEFAULT 'system',
  title TEXT,
  body TEXT,
  kind TEXT DEFAULT 'info',
  link TEXT,
  read INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'in_app',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  email_enabled INTEGER DEFAULT 1,
  in_app_enabled INTEGER DEFAULT 1,
  sms_enabled INTEGER DEFAULT 0,
  preferred_email TEXT,
  preferred_phone TEXT,
  notify_assignments INTEGER DEFAULT 1,
  notify_status_updates INTEGER DEFAULT 1,
  notify_public_alerts INTEGER DEFAULT 1,
  notify_team_comms INTEGER DEFAULT 1,
  notify_escalations INTEGER DEFAULT 1,
  min_severity INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER,
  event_id TEXT NOT NULL,
  incident_id INTEGER,
  recipient_id INTEGER,
  recipient_address TEXT NOT NULL,
  recipient_name TEXT,
  channel TEXT NOT NULL,
  severity INTEGER DEFAULT 2,
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  provider_response TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT,
  delivered_at TEXT
);
CREATE TABLE IF NOT EXISTS notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  channels_json TEXT DEFAULT '["email","in_app"]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_escalations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  stage INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  current_target_role TEXT,
  current_target_name TEXT,
  current_target_id INTEGER,
  threshold_minutes INTEGER DEFAULT 5,
  triggered_at TEXT NOT NULL,
  escalated_at TEXT,
  acknowledged_at TEXT,
  notes TEXT,
  history_json TEXT DEFAULT '[]',
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  incident_id INTEGER,
  event_type TEXT NOT NULL,
  actor_id INTEGER,
  actor_name TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  delivery_log_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  priority_score INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (delivery_log_id) REFERENCES notification_delivery_logs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_incident ON messages(incident_id);
`);

const normalise = (params = []) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));

export function all(sql, params = []) {
  return db.prepare(sql).all(...normalise(params));
}
export function get(sql, params = []) {
  return db.prepare(sql).get(...normalise(params));
}
export function run(sql, params = []) {
  return db.prepare(sql).run(...normalise(params));
}
export function insert(table, data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  const columns = entries.map(([key]) => key).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const result = run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, entries.map(([, value]) => value));
  return Number(result.lastInsertRowid);
}
export function update(table, id, data) {
  // null is a meaningful value (clearing an assignment / reopening an incident),
  // so only undefined fields are skipped.
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  run(`UPDATE ${table} SET ${assignments} WHERE id = ?`, [...entries.map(([, value]) => value), id]);
}
export function remove(table, id) {
  return run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}
export function now() {
  return new Date().toISOString();
}

// Seed once on a fresh database.
if (get('SELECT COUNT(*) AS count FROM users').count === 0) {
  seedDatabase({ insert, run, get, all, now });
}

function migrateNotificationColumns() {
  try {
    const existingColumns = all('PRAGMA table_info(notifications)').map((c) => c.name);
    if (!existingColumns.includes('incident_id')) run('ALTER TABLE notifications ADD COLUMN incident_id INTEGER;');
    if (!existingColumns.includes('event_id')) run('ALTER TABLE notifications ADD COLUMN event_id TEXT;');
    if (!existingColumns.includes('category')) run("ALTER TABLE notifications ADD COLUMN category TEXT DEFAULT 'system';");
    if (!existingColumns.includes('channel')) run("ALTER TABLE notifications ADD COLUMN channel TEXT DEFAULT 'in_app';");
    if (!existingColumns.includes('archived')) run('ALTER TABLE notifications ADD COLUMN archived INTEGER DEFAULT 0;');

    run('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, archived);');
    run('CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id);');
    run('CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON notification_delivery_logs(status, channel);');
    run('CREATE INDEX IF NOT EXISTS idx_delivery_logs_incident ON notification_delivery_logs(incident_id);');
    run('CREATE INDEX IF NOT EXISTS idx_delivery_logs_created ON notification_delivery_logs(created_at);');
    run('CREATE INDEX IF NOT EXISTS idx_escalations_incident ON notification_escalations(incident_id, status);');
    run('CREATE INDEX IF NOT EXISTS idx_queue_poll ON notification_queue(status, next_attempt_at, priority_score);');
    run('CREATE INDEX IF NOT EXISTS idx_events_unique ON notification_events(event_id);');
  } catch (err) {
    console.error('[DB Migration]', err.message);
  }
}
migrateNotificationColumns();

function seedDefaultNotificationPreferences() {
  try {
    const usersWithoutPrefs = all(`
      SELECT u.id, u.email, u.phone FROM users u
      LEFT JOIN notification_preferences np ON np.user_id = u.id
      WHERE np.id IS NULL
    `);
    for (const u of usersWithoutPrefs) {
      insert('notification_preferences', {
        user_id: u.id,
        email_enabled: 1,
        in_app_enabled: 1,
        sms_enabled: 0,
        preferred_email: u.email,
        preferred_phone: u.phone || null,
        notify_assignments: 1,
        notify_status_updates: 1,
        notify_public_alerts: 1,
        notify_team_comms: 1,
        notify_escalations: 1,
        min_severity: 1,
        updated_at: now(),
      });
    }
  } catch (err) {
    console.error('[DB Notification Prefs Seed]', err.message);
  }
}
seedDefaultNotificationPreferences();

function seedNotificationTemplates() {
  try {
    const count = get('SELECT COUNT(*) AS count FROM notification_templates')?.count || 0;
    if (count === 0) {
      const templates = [
        ['sos_activated', 'Critical SOS Emergency', '[CRITICAL SOS] {{incident.code}} — {{incident.title}}', 'Emergency SOS activated at {{incident.address}}.'],
        ['incident_new', 'New Emergency Incident', '[{{incident.urgency}}] {{incident.code}} — {{incident.title}}', 'New incident reported in {{incident.zone}}.'],
        ['critical_detected', 'Critical Emergency Detected', '[CRITICAL ALERT] {{incident.code}} — {{incident.title}}', 'AI detected high-severity emergency.'],
        ['team_assigned', 'Team Dispatch Order', '[TEAM DISPATCH] {{team.name}} assigned to {{incident.code}}', 'Unit deployed to scene.'],
        ['team_reassigned', 'Team Reassignment', '[REASSIGNMENT] {{incident.code}} transferred to {{newTeam.name}}', 'Incident reallocated.'],
        ['status_changed', 'Incident Status Changed', '[STATUS UPDATE] {{incident.code}} is now {{newStatus}}', 'Status updated.'],
        ['incident_resolved', 'Incident Resolved', '[RESOLVED] {{incident.code}} — {{incident.title}}', 'Emergency successfully resolved.'],
        ['duplicate_detected', 'Duplicate Report Flagged', '[DUPLICATE REPORT] {{incident.code}} matched with {{primaryIncident.code}}', 'Correlated duplicate report.'],
        ['broadcast_published', 'Public Alert Published', '[PUBLIC ALERT: {{broadcast.level}}] {{broadcast.title}}', 'Official emergency broadcast.'],
        ['assignment_overdue', 'Assignment Overdue', '[SLA OVERDUE] {{incident.code}} unacknowledged', 'Response SLA breached.'],
        ['team_acknowledged', 'Team Dispatch Confirmed', '[ACKNOWLEDGED] {{team.name}} confirmed dispatch for {{incident.code}}', 'Unit en route.'],
        ['escalation_triggered', 'Automated Emergency Escalation', '[ESCALATION STAGE {{stage}}] {{incident.code}} — {{incident.title}}', 'Incident escalated to higher command.'],
      ];
      for (const [key, name, subject, body] of templates) {
        insert('notification_templates', {
          key, name, subject_template: subject, body_template: body, channels_json: JSON.stringify(['email', 'in_app']), updated_at: now(),
        });
      }
    }
  } catch (err) {
    console.error('[DB Notification Templates Seed]', err.message);
  }
}
seedNotificationTemplates();


function migrateSessionSecurity() {
  try {
    const sessionCols = all('PRAGMA table_info(sessions)').map((c) => c.name);
    if (!sessionCols.includes('device_info')) run('ALTER TABLE sessions ADD COLUMN device_info TEXT;');
    if (!sessionCols.includes('ip_address')) run('ALTER TABLE sessions ADD COLUMN ip_address TEXT;');
    if (!sessionCols.includes('last_activity_at')) run('ALTER TABLE sessions ADD COLUMN last_activity_at TEXT;');

    run(`CREATE TABLE IF NOT EXISTS login_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      success INTEGER DEFAULT 0,
      ip_address TEXT,
      device_info TEXT,
      timestamp TEXT NOT NULL,
      session_token TEXT,
      failure_reason TEXT
    );`);

    run(`CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );`);

    run('CREATE INDEX IF NOT EXISTS idx_login_activity_user ON login_activity(user_id, timestamp);');
    run('CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_logs(user_id, created_at);');
    run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);');
  } catch (err) {
    console.error('[DB Session Security Migration]', err.message);
  }
}
migrateSessionSecurity();

export function activity(type, title, detail, actorName = 'OFFGRID System', entityType = null, entityId = null) {
  insert('activity', {
    type, title, detail, actor_name: actorName,
    entity_type: entityType, entity_id: entityId, created_at: now(),
  });
  run('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 120)');
}
