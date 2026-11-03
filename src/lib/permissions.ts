import { Role } from './types';

export const ROLE_CAPABILITIES: Record<Role, string[]> = {
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

export function roleCan(role: Role | undefined, capability: string): boolean {
  return Boolean(role && ROLE_CAPABILITIES[role]?.includes(capability));
}

export const ROLE_LABEL: Record<Role, string> = {
  citizen: 'Citizen',
  responder: 'Emergency Responder',
  authority: 'Disaster Authority',
  hospital: 'Hospital Coordinator',
  medical: 'Medical Team',
  admin: 'Platform Administrator',
};
