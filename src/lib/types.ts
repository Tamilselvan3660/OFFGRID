export type Role = 'citizen' | 'responder' | 'authority' | 'hospital' | 'medical' | 'admin';
export type IncidentStatus = 'pending' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'duplicate';
export type ResourceKey = 'incidents' | 'teams' | 'hospitals' | 'resources' | 'broadcasts' | 'users';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  zone?: string;
  designation?: string;
  status?: string;
  avatar_color?: string;
  initials?: string;
  team_id?: number | null;
  created_at?: string;
  last_active_at?: string;
}

export interface Incident {
  id: number | string;
  code: string;
  title: string;
  description?: string;
  category: string;
  category_label?: string;
  category_color?: string;
  severity: number;
  priority_score: number;
  status: IncidentStatus;
  source: string;
  reporter_id?: number;
  reporter_name?: string;
  reporter_phone?: string;
  latitude: number;
  longitude: number;
  address?: string;
  zone?: string;
  people_affected: number;
  vulnerable_count: number;
  ai_confidence?: number;
  reasoning?: string[];
  tags?: string[];
  duplicate_of?: number | null;
  duplicate_score?: number | null;
  assigned_team_id?: number | null;
  assigned_hospital_id?: number | null;
  live_location?: boolean;
  offline_synced?: boolean;
  sla_minutes?: number;
  notes?: { at: string; text: string; author: string }[];
  created_at: string;
  updated_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  urgency?: string;
  _optimistic?: boolean;
  pendingSync?: boolean;
}

export interface Team {
  id: number | string;
  name: string;
  code: string;
  type: string;
  zone?: string;
  leader_name?: string;
  status: string;
  capacity: number;
  members: number;
  active_incidents: number;
  latitude: number;
  longitude: number;
  skills?: string[];
  equipment?: string[];
  contact?: string;
  created_at?: string;
  _optimistic?: boolean;
}

export interface Hospital {
  id: number | string;
  name: string;
  code: string;
  zone?: string;
  address?: string;
  latitude: number;
  longitude: number;
  beds_total: number;
  beds_available: number;
  icu_total: number;
  icu_available: number;
  oxygen_units: number;
  ambulances: number;
  blood_units?: Record<string, number>;
  trauma_level?: string;
  status: string;
  contact?: string;
  updated_at?: string;
  _optimistic?: boolean;
}

export interface ResourceItem {
  id: number | string;
  name: string;
  category?: string;
  quantity: number;
  unit: string;
  threshold: number;
  zone?: string;
  supplier?: string;
  status: string;
  updated_at?: string;
  _optimistic?: boolean;
}

export interface Broadcast {
  id: number | string;
  title: string;
  body: string;
  level: 'advisory' | 'warning' | 'critical';
  status: string;
  recipients: number;
  zones?: string[];
  channels?: string[];
  author_name?: string;
  created_at: string;
  _optimistic?: boolean;
}

export interface Message {
  id: number | string;
  incident_id: number;
  user_id?: number | null;
  author_name: string;
  author_role?: string;
  body: string;
  kind: string;
  created_at: string;
  pendingSync?: boolean;
  _optimistic?: boolean;
}

export interface ActivityItem {
  id: number;
  type: string;
  title: string;
  detail?: string;
  actor_name?: string;
  entity_type?: string;
  entity_id?: number;
  created_at: string;
}

export type NotificationCategory = 'sos' | 'incident_new' | 'assignment' | 'status_change' | 'public_alert' | 'escalation' | 'team_comm' | 'system';

export interface NotificationItem {
  id: number;
  user_id?: number | null;
  incident_id?: number | null;
  event_id?: string;
  category?: NotificationCategory | string;
  title: string;
  body: string;
  kind: string;
  link?: string;
  read: boolean;
  archived?: boolean;
  channel?: string;
  created_at: string;
}

export interface NotificationDeliveryLog {
  id: number;
  notification_id?: number | null;
  event_id: string;
  incident_id?: number | null;
  recipient_id?: number | null;
  recipient_address: string;
  recipient_name?: string;
  channel: 'email' | 'in_app' | 'sms' | 'sse' | string;
  severity: number;
  priority: 'immediate' | 'high' | 'normal' | 'low' | string;
  status: 'pending' | 'queued' | 'processing' | 'accepted' | 'delivered' | 'failed' | 'retrying';
  retry_count: number;
  max_retries: number;
  error_message?: string | null;
  provider_response?: string | null;
  created_at: string;
  processed_at?: string | null;
  delivered_at?: string | null;
}

export interface NotificationEscalation {
  id: number;
  incident_id: number;
  incident_code?: string;
  incident_title?: string;
  incident_severity?: number;
  incident_zone?: string;
  stage: number;
  status: 'active' | 'acknowledged' | 'resolved' | 'cancelled';
  current_target_role: string;
  current_target_name: string;
  threshold_minutes: number;
  triggered_at: string;
  escalated_at?: string;
  acknowledged_at?: string;
  notes?: string;
  history?: {
    stage?: number;
    fromStage?: number;
    targetRole?: string;
    targetName?: string;
    triggeredAt?: string;
    reason?: string;
    action?: string;
    by?: string;
    at?: string;
  }[];
}

export interface NotificationPreferences {
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
  preferred_email?: string | null;
  preferred_phone?: string | null;
  notify_assignments: boolean;
  notify_status_updates: boolean;
  notify_public_alerts: boolean;
  notify_team_comms: boolean;
  notify_escalations: boolean;
  min_severity: number;
}

export interface NotificationMonitoringStats {
  totalDeliveries: number;
  acceptedEmails: number;
  pendingNotifications: number;
  failedNotifications: number;
  criticalNotifications: number;
  inAppCount: number;
  smsCount: number;
  queueStatus: {
    workerActive: boolean;
    pendingJobs: number;
    processingJobs: number;
    failedJobs: number;
    retryingJobs: number;
    acceptedJobs: number;
    totalProcessed: number;
    avgProcessingTimeMs: number;
    concurrencyLimit: number;
  };
  smtpStatus: {
    configured: boolean;
    provider: string;
    host: string;
    port: number;
    secure: boolean;
    fromName: string;
    fromEmail: string;
    maskedUser: string | null;
    supportsEncryption: boolean;
    supportedPorts: number[];
  };
  channelStats: { channel: string; status: string; count: number }[];
  lastUpdated: string;
}

export interface Recommendation {
  id: number;
  name: string;
  code: string;
  type: string;
  status: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  specialtyMatch: boolean;
  reasons: string[];
}

export interface Classification {
  category: string;
  categoryLabel: string;
  severity: number;
  confidence: number;
  suggestedTeamType: string;
  tags: string[];
  slaMinutes: number;
  reasoning: string[];
  urgencyLabel: string;
}

export interface Analytics {
  kpis: Record<string, number>;
  categoryBreakdown: { key: string; name: string; value: number; color: string }[];
  zoneLoad: { zone: string; total: number; active: number; critical: number }[];
  severityDistribution: { name: string; value: number }[];
  trend: { date: string; label: string; reported: number; resolved: number; active: number }[];
  teamWorkload: { name: string; active: number; capacity: number; status: string }[];
}

export interface CollectionState {
  incidents: Incident[];
  teams: Team[];
  hospitals: Hospital[];
  resources: ResourceItem[];
  broadcasts: Broadcast[];
  users: User[];
  activity: ActivityItem[];
  notifications: NotificationItem[];
  messages: Message[];
  analytics: Analytics | null;
  settings: Record<string, string>;
}

export interface OfflineQueueItem {
  id: string;
  type: 'incident' | 'message';
  endpoint: string;
  body: Record<string, unknown>;
  tempId: string;
  incidentId?: number;
  createdAt: string;
  label: string;
}
