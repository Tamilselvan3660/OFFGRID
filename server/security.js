import crypto from 'node:crypto';

export const ROLES = {
  citizen: 'Citizen',
  responder: 'Emergency Responder',
  authority: 'Disaster Authority',
  hospital: 'Hospital Coordinator',
  medical: 'Medical Team',
  admin: 'Platform Administrator',
};

export const ROLE_CAPABILITIES = {
  citizen: ['incident:create', 'incident:view', 'message:create', 'map:view', 'broadcast:view'],
  responder: [
    'incident:create', 'incident:view', 'incident:update', 'message:create',
    'team:view', 'hospital:view', 'resource:view', 'broadcast:view',
    'analytics:view', 'map:view', 'all:view',
  ],
  authority: [
    'incident:create', 'incident:view', 'incident:update', 'incident:delete', 'incident:assign',
    'message:create', 'message:delete', 'team:view', 'team:manage',
    'hospital:view', 'hospital:manage', 'resource:view', 'resource:manage',
    'broadcast:view', 'broadcast:manage', 'user:view', 'user:manage',
    'analytics:view', 'map:view', 'all:view',
  ],
  hospital: [
    'incident:view', 'incident:update', 'message:create', 'hospital:view', 'hospital:manage',
    'resource:view', 'broadcast:view', 'analytics:view', 'map:view', 'all:view',
  ],
  medical: [
    'incident:view', 'incident:update', 'message:create', 'hospital:view', 'hospital:manage',
    'resource:view', 'team:view', 'broadcast:view', 'analytics:view', 'map:view', 'all:view',
  ],
  admin: [
    'incident:create', 'incident:view', 'incident:update', 'incident:delete', 'incident:assign',
    'message:create', 'message:delete', 'team:view', 'team:manage',
    'hospital:view', 'hospital:manage', 'resource:view', 'resource:manage',
    'broadcast:view', 'broadcast:manage', 'user:view', 'user:manage',
    'analytics:view', 'map:view', 'all:view', 'settings:manage',
  ],
};

export const ROLE_HOME = {
  citizen: 'My Reports',
  responder: 'Assigned Missions',
  authority: 'Command Center',
  hospital: 'Hospital Operations',
  medical: 'Medical Triage',
  admin: 'Command Center',
};

export function can(role, capability) {
  return Boolean(ROLE_CAPABILITIES[role]?.includes(capability));
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expectedBuf = Buffer.from(expected, 'hex');
  return actual.length === expectedBuf.length && crypto.timingSafeEqual(actual, expectedBuf);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
