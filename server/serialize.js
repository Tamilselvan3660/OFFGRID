import { categoryLabel, categoryColor, parseJson } from './ai.js';

const JSON_KEYS = [
  'skills_json', 'equipment_json', 'blood_units_json', 'zones_json', 'channels_json',
  'ai_reasoning_json', 'tags_json', 'notes_json', 'history_json', 'payload_json',
];
const BOOL_KEYS = [
  'live_location', 'offline_synced', 'read', 'archived',
  'email_enabled', 'in_app_enabled', 'sms_enabled',
  'notify_assignments', 'notify_status_updates', 'notify_public_alerts',
  'notify_team_comms', 'notify_escalations',
];

export function serializeRow(table, row) {
  if (!row) return null;
  const output = { ...row };
  if (table === 'users') delete output.password_hash;
  for (const key of JSON_KEYS) {
    if (key in output) output[key.replace('_json', '')] = parseJson(output[key], key.endsWith('units_json') ? {} : []);
  }
  for (const key of BOOL_KEYS) if (key in output) output[key] = Boolean(output[key]);
  if (table === 'incidents') {
    output.category_label = categoryLabel(output.category);
    output.category_color = categoryColor(output.category);
    output.urgency = output.severity >= 5 ? 'CRITICAL' : output.severity >= 4 ? 'HIGH' : output.severity >= 3 ? 'MODERATE' : 'LOW';
  }
  return output;
}

export function serializeRows(table, rows = []) {
  return rows.map((row) => serializeRow(table, row));
}
