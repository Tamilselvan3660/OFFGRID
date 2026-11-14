import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, BrainCircuit, CheckCircle2, CloudUpload, Database, Download, HardDrive,
  Mail, MessageSquare, Radio, RefreshCw, Save, ShieldCheck, Siren, Trash2, UserRound, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { get, patch } from '../lib/api';
import { ZONES } from '../lib/geo';
import { formatDateTime, timeAgo } from '../lib/format';
import { NotificationPreferences } from '../lib/types';
import {
  Avatar, Badge, Button, Card, CardHead, EmptyState, Field, Select, StatCard,
  TextInput, Toggle,
} from '../components/ui';

export function Settings() {
  const {
    user, updateProfile, data, setSetting, isOffline, offlineMode, setOfflineMode,
    queue, syncing, flushQueue, removeQueueItem, simulateSos, sseConnected, can, pushToast,
  } = useApp();
  const [profile, setProfile] = useState({
    name: user?.name || '', phone: user?.phone || '', zone: user?.zone || 'Central Chennai',
    designation: user?.designation || '', password: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [health, setHealth] = useState<any | null>(null);
  const [threshold, setThreshold] = useState('0.34');
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_enabled: true,
    in_app_enabled: true,
    sms_enabled: false,
    preferred_email: user?.email || '',
    preferred_phone: user?.phone || '',
    notify_assignments: true,
    notify_status_updates: true,
    notify_public_alerts: true,
    notify_team_comms: true,
    notify_escalations: true,
    min_severity: 1,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    get('/health').then(setHealth).catch(() => setHealth(null));
    get('/notifications/preferences').then((res) => {
      if (res?.preferences) setPrefs(res.preferences);
    }).catch(() => {});
  }, []);

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      await patch('/notifications/preferences', prefs);
      pushToast({ title: 'Notification preferences saved', tone: 'success' });
    } catch (err: any) {
      pushToast({ title: 'Failed to save preferences', description: err.message, tone: 'error' });
    } finally {
      setSavingPrefs(false);
    }
  };

  useEffect(() => {
    if (data.settings.duplicate_threshold) setThreshold(data.settings.duplicate_threshold);
  }, [data.settings.duplicate_threshold]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = { ...profile };
      if (!payload.password) delete payload.password;
      await updateProfile(payload);
      setProfile((prev) => ({ ...prev, password: '' }));
    } catch { /* handled */ }
    finally { setSavingProfile(false); }
  };

  return (
    <div className="page-stack settings-page">
      <div className="settings-grid">
        <Card>
          <CardHead title="Your profile" subtitle="Personal details used across incident reports" icon={UserRound} tone="blue" />
          <div className="profile-hero">
            <Avatar name={user?.name} color={user?.avatar_color} size={58} />
            <div><strong>{user?.name}</strong><span>{user?.email}</span><Badge tone="orange">{user?.role}</Badge></div>
          </div>
          <div className="form-grid">
            <Field label="Full name" required className="span-2"><TextInput value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
            <Field label="Phone number"><TextInput value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></Field>
            <Field label="Operating zone"><Select value={profile.zone} onChange={(event) => setProfile({ ...profile, zone: event.target.value })}>{ZONES.map((zone) => <option key={zone}>{zone}</option>)}</Select></Field>
            <Field label="Designation" className="span-2"><TextInput value={profile.designation} onChange={(event) => setProfile({ ...profile, designation: event.target.value })} /></Field>
            <Field label="New password" hint="Leave blank to keep your current password." className="span-2"><TextInput type="password" value={profile.password} onChange={(event) => setProfile({ ...profile, password: event.target.value })} placeholder="••••••••" /></Field>
          </div>
          <div className="settings-card-foot"><Button variant="primary" icon={Save} loading={savingProfile} onClick={saveProfile}>Save profile</Button></div>
        </Card>

        <Card>
          <CardHead title="Connectivity & offline mode" subtitle="Offline-first reporting keeps working without a network" icon={isOffline ? WifiOff : Wifi} tone={isOffline ? 'orange' : 'teal'} />
          <div className={`connectivity-hero ${isOffline ? 'offline' : ''}`}>
            <span className="connectivity-icon">{isOffline ? <WifiOff size={24} /> : <CloudUpload size={24} />}</span>
            <div><strong>{isOffline ? 'Working offline' : 'Connected to OFFGRID'}</strong><p>{isOffline ? 'New reports and messages are queued on this device.' : 'Real-time event stream and live telemetry are active.'}</p></div>
            <Badge tone={isOffline ? 'amber' : 'green'} dot>{isOffline ? 'Queued' : 'Online'}</Badge>
          </div>
          <div className="settings-toggle-list">
            <Toggle checked={offlineMode} onChange={setOfflineMode} label="Force offline mode" description="Simulate a lost connection and test offline reporting." />
            <Toggle checked={data.settings.auto_allocate !== 'false'} onChange={(value) => setSetting('auto_allocate', value)} label="Auto-allocate critical SOS" description="Assign the best-ranked rescue team immediately for S5 or SOS reports." disabled={!can('settings:manage')} />
            <Toggle checked={data.settings.simulate_live !== 'false'} onChange={(value) => setSetting('simulate_live', value)} label="Live team telemetry" description="Deployed units send position updates every 9 seconds." disabled={!can('settings:manage')} />
          </div>
          <div className="settings-inline-field">
            <Field label="Duplicate detection threshold" hint="Lower values flag more possible duplicates.">
              <div className="row gap-8">
                <TextInput type="number" step="0.01" min="0.1" max="0.9" value={threshold} onChange={(event) => setThreshold(event.target.value)} disabled={!can('settings:manage')} />
                <Button variant="outline" size="sm" disabled={!can('settings:manage')} onClick={() => setSetting('duplicate_threshold', threshold)}>Apply</Button>
              </div>
            </Field>
          </div>
          <div className="settings-divider" />
          <div className="setting-stat-row"><span>Event stream</span><Badge tone={sseConnected ? 'green' : 'amber'} dot>{sseConnected ? 'Connected' : 'Reconnecting'}</Badge></div>
          <div className="setting-stat-row"><span>Last server check</span><span>{health ? timeAgo(health.time) : '—'}</span></div>
          <div className="setting-stat-row"><span>Network</span><span>{data.settings.network_name || 'Chennai Regional Emergency Network'}</span></div>
        </Card>

        <Card className="span-2">
          <CardHead
            title="Emergency Notification & Communication Preferences"
            subtitle="Configure multi-channel alert delivery, priority thresholds and contact endpoints"
            icon={Bell}
            tone="orange"
          />

          <div className="notification-policy-banner">
            <AlertTriangle size={18} className="text-orange" />
            <div>
              <strong>Emergency Override Policy Active</strong>
              <p>
                In accordance with network emergency response protocols, <strong>Critical (S5)</strong> and <strong>SOS alerts</strong> automatically override non-urgent preferences to ensure immediate responder mobilization.
              </p>
            </div>
          </div>

          <div className="form-grid mt-16">
            <Field label="Preferred Notification Email" hint="Detailed incident alerts will be delivered via SMTP relay here.">
              <TextInput
                value={prefs.preferred_email || ''}
                onChange={(e) => setPrefs({ ...prefs, preferred_email: e.target.value })}
                placeholder="name@offgrid.in"
              />
            </Field>

            <Field label="Emergency SMS Mobile Number" hint="SMS alerts dispatched for immediate critical incidents.">
              <TextInput
                value={prefs.preferred_phone || ''}
                onChange={(e) => setPrefs({ ...prefs, preferred_phone: e.target.value })}
                placeholder="+91 98400 11000"
              />
            </Field>

            <Field label="Minimum Notification Severity" hint="Only notify for incidents at or above this severity (S1-S5).">
              <Select
                value={String(prefs.min_severity)}
                onChange={(e) => setPrefs({ ...prefs, min_severity: Number(e.target.value) })}
              >
                <option value="1">S1 — All Incidents (Low & above)</option>
                <option value="2">S2 — Moderate & above</option>
                <option value="3">S3 — Medium & above</option>
                <option value="4">S4 — High & Critical only</option>
                <option value="5">S5 — Critical emergencies only</option>
              </Select>
            </Field>
          </div>

          <div className="settings-divider" />

          <div className="settings-toggle-grid">
            <div className="toggle-group">
              <strong>Delivery Channels</strong>
              <div className="settings-toggle-list">
                <Toggle
                  checked={prefs.email_enabled}
                  onChange={(val) => setPrefs({ ...prefs, email_enabled: val })}
                  label="SMTP Email Notifications"
                  description="Receive responsive HTML incident summaries via SMTP relay."
                />
                <Toggle
                  checked={prefs.in_app_enabled}
                  onChange={(val) => setPrefs({ ...prefs, in_app_enabled: val })}
                  label="Real-Time In-App Alerts"
                  description="Display live alerts in topbar and notification center."
                />
                <Toggle
                  checked={prefs.sms_enabled}
                  onChange={(val) => setPrefs({ ...prefs, sms_enabled: val })}
                  label="Mobile SMS Gateway"
                  description="Send SMS text alerts when mobile gateway is available."
                />
              </div>
            </div>

            <div className="toggle-group">
              <strong>Notification Categories</strong>
              <div className="settings-toggle-list">
                <Toggle
                  checked={prefs.notify_assignments}
                  onChange={(val) => setPrefs({ ...prefs, notify_assignments: val })}
                  label="Rescue Team Assignments"
                  description="Alert when your unit is dispatched or reallocated."
                />
                <Toggle
                  checked={prefs.notify_status_updates}
                  onChange={(val) => setPrefs({ ...prefs, notify_status_updates: val })}
                  label="Incident Status & Resolutions"
                  description="Updates when triage status changes or reports resolve."
                />
                <Toggle
                  checked={prefs.notify_escalations}
                  onChange={(val) => setPrefs({ ...prefs, notify_escalations: val })}
                  label="Emergency Escalation Alerts"
                  description="High-priority alerts when response SLA thresholds breach."
                />
                <Toggle
                  checked={prefs.notify_public_alerts}
                  onChange={(val) => setPrefs({ ...prefs, notify_public_alerts: val })}
                  label="Public Emergency Broadcasts"
                  description="Advisories, weather warnings and evacuation orders."
                />
              </div>
            </div>
          </div>

          <div className="settings-card-foot mt-16">
            <Button
              variant="primary"
              icon={Save}
              loading={savingPrefs}
              onClick={savePrefs}
            >
              Save Notification Preferences
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Offline queue"
          subtitle={`${queue.length} item${queue.length === 1 ? '' : 's'} waiting to sync · stored in this browser`}
          icon={HardDrive}
          tone="violet"
          action={<Button size="sm" variant="outline" icon={RefreshCw} loading={syncing} disabled={isOffline || queue.length === 0} onClick={flushQueue}>Sync now</Button>}
        />
        {queue.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing waiting to sync" description="Turn on offline mode, submit a report, then reconnect — the queue will upload automatically." />
        ) : (
          <div className="queue-list">
            {queue.map((item) => (
              <div className="queue-row" key={item.id}>
                <span className="queue-icon"><CloudUpload size={16} /></span>
                <div><strong>{item.label}</strong><small>{item.type === 'incident' ? 'Emergency report' : 'Channel message'} · queued {formatDateTime(item.createdAt)}</small></div>
                <Badge tone="amber" dot>Pending</Badge>
                <button onClick={() => removeQueueItem(item.id)} aria-label="Remove queued item"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="settings-grid">
        <Card>
          <CardHead title="Demo & simulation tools" subtitle="Make the network feel alive with realistic incoming events" icon={Zap} tone="orange" />
          <div className="simulation-list">
            <div className="simulation-row"><span className="simulation-icon tone-red"><Siren size={17} /></span><div><strong>Simulate incoming SOS</strong><p>Generates a new sensor/SOS report classified by the AI engine and pushes it to every connected dashboard.</p></div><Button size="sm" variant="outline" onClick={simulateSos}>Simulate</Button></div>
            <div className="simulation-row"><span className="simulation-icon tone-blue"><BrainCircuit size={17} /></span><div><strong>AI classification preview</strong><p>Open the SOS dialog and type a description to watch category, severity, priority, duplicates and team recommendations update live.</p></div><Button size="sm" variant="ghost" onClick={() => pushToast({ title: 'Tip', description: 'Use the SOS button in the top bar.', tone: 'info' })}>How to</Button></div>
            <div className="simulation-row"><span className="simulation-icon tone-teal"><Radio size={17} /></span><div><strong>Live telemetry</strong><p>Deployed rescue teams move toward their highest-priority incident and the map updates through server-sent events.</p></div><Badge tone="green" dot>Active</Badge></div>
          </div>
        </Card>

        <Card>
          <CardHead title="System information" subtitle="Runtime and persistent storage details" icon={Database} tone="blue" />
          <div className="system-info-list">
            <div><span>Service</span><strong>{health?.service || 'OFFGRID Emergency Network'}</strong></div>
            <div><span>Version</span><strong className="mono">{health?.version || '1.0.0'}</strong></div>
            <div><span>API status</span><Badge tone={health?.status === 'operational' ? 'green' : 'amber'} dot>{health?.status || 'checking'}</Badge></div>
            <div><span>Database</span><strong>{health?.database || 'SQLite (persistent)'}</strong></div>
            <div><span>Persisted incidents</span><strong>{health?.incidents ?? data.incidents.length}</strong></div>
            <div><span>Real-time transport</span><strong>Server-Sent Events</strong></div>
            <div><span>AI engine</span><strong>On-device explainable rules</strong></div>
            <div><span>Offline storage</span><strong>localStorage + service worker cache</strong></div>
          </div>
          <div className="settings-card-foot"><Button variant="ghost" icon={Download} onClick={() => window.open('/api/export/incidents.csv', '_blank')}>Export incident CSV</Button></div>
        </Card>
      </div>
    </div>
  );
}
