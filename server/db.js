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
  title TEXT,
  body TEXT,
  kind TEXT DEFAULT 'info',
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
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

export function activity(type, title, detail, actorName = 'OFFGRID System', entityType = null, entityId = null) {
  insert('activity', {
    type, title, detail, actor_name: actorName,
    entity_type: entityType, entity_id: entityId, created_at: now(),
  });
  run('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 120)');
}
