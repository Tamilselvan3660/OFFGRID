export const CATEGORY_OPTIONS = [
  { value: 'flood', label: 'Flood & Water Rescue', color: '#3b7ff5' },
  { value: 'medical', label: 'Medical Emergency', color: '#e5484d' },
  { value: 'fire', label: 'Fire & Explosion', color: '#f26430' },
  { value: 'structural', label: 'Structural Collapse', color: '#a263e8' },
  { value: 'accident', label: 'Road / Transport Accident', color: '#e9a426' },
  { value: 'landslide', label: 'Landslide / Terrain', color: '#8a7a5c' },
  { value: 'utility', label: 'Power / Utility Failure', color: '#0f9b8e' },
  { value: 'missing', label: 'Missing / Trapped Person', color: '#d9559b' },
  { value: 'hazard', label: 'Chemical / Hazard', color: '#6a8f2f' },
  { value: 'other', label: 'Other / Unclassified', color: '#7b8798' },
];

export const TEAM_TYPES = [
  'Water Rescue', 'Medical Response', 'Fire & Rescue', 'Urban Search & Rescue',
  'Drone Surveillance', 'Evacuation & Relief', 'Power & Utilities', 'Hazmat',
];

export const TEAM_STATUSES = ['available', 'deployed', 'standby', 'offline'];
export const HOSPITAL_STATUSES = ['operational', 'limited', 'full', 'offline'];
export const RESOURCE_STATUSES = ['available', 'low', 'reserved', 'unavailable'];
export const BROADCAST_LEVELS = ['advisory', 'warning', 'critical'];
export const BROADCAST_STATUSES = ['draft', 'sent', 'archived'];
export const USER_ROLES = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'responder', label: 'Emergency Responder' },
  { value: 'authority', label: 'Disaster Authority' },
  { value: 'hospital', label: 'Hospital Coordinator' },
  { value: 'medical', label: 'Medical Team' },
  { value: 'admin', label: 'Platform Administrator' },
];
export const USER_STATUSES = ['active', 'suspended', 'inactive'];

export function asOptions(values: string[]) {
  return values.map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) }));
}
