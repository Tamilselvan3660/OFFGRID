import { IncidentStatus } from './types';

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  pending: 'Pending triage',
  triaged: 'Triaged',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  duplicate: 'Duplicate',
};

export const STATUS_TONES: Record<IncidentStatus, string> = {
  pending: 'amber',
  triaged: 'blue',
  assigned: 'violet',
  in_progress: 'orange',
  resolved: 'green',
  closed: 'slate',
  duplicate: 'slate',
};

export const ROLE_LABELS: Record<string, string> = {
  citizen: 'Citizen',
  responder: 'Emergency Responder',
  authority: 'Disaster Authority',
  hospital: 'Hospital Coordinator',
  medical: 'Medical Team',
  admin: 'Platform Administrator',
};

export const LEVEL_TONES: Record<string, string> = {
  advisory: 'blue',
  warning: 'amber',
  critical: 'red',
  info: 'blue',
  success: 'green',
};

export function formatNumber(value: number | string | undefined | null, fallback = '0'): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return new Intl.NumberFormat('en-IN').format(number);
}

export function compactNumber(value: number | string | undefined | null): string {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 100000) return `${(number / 100000).toFixed(1)}L`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return '—';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function relativeDue(value?: string | null, slaMinutes = 20): string {
  if (!value) return 'SLA —';
  const elapsed = (Date.now() - new Date(value).getTime()) / 60000;
  const remaining = slaMinutes - elapsed;
  if (remaining <= 0) return `${Math.abs(Math.round(remaining))}m overdue`;
  return `${Math.round(remaining)}m left`;
}

export function titleCase(value?: string | null): string {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function initials(name = ''): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export function minutesLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function safeText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}
