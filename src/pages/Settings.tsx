import React, { useEffect, useState } from 'react';
import {
  Activity, BrainCircuit, CheckCircle2, CloudUpload, Database, Download, HardDrive,
  Radio, RefreshCw, Save, ShieldCheck, Siren, Trash2, UserRound, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { get } from '../lib/api';
import { ZONES } from '../lib/geo';
import { formatDateTime, timeAgo } from '../lib/format';
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

  useEffect(() => {
    get('/health').then(setHealth).catch(() => setHealth(null));
  }, []);

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
