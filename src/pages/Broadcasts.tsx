import React from 'react';
import { BellRing, Megaphone, Radio, Send, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { BROADCAST_LEVELS, BROADCAST_STATUSES, asOptions } from '../lib/constants';
import { formatNumber, timeAgo } from '../lib/format';
import { Badge, Card, CardHead, EmptyState, LevelBadge, StatCard } from '../components/ui';
import { ResourceManager, type FormField, type TableColumn } from '../components/ResourceManager';

const CHANNELS = ['app', 'sms', 'siren', 'radio', 'email'];

const fields: FormField[] = [
  { key: 'title', label: 'Alert headline', type: 'text', required: true, span: 2, placeholder: 'Red alert: heavy rainfall warning' },
  { key: 'body', label: 'Message body', type: 'textarea', required: true, span: 2, placeholder: 'What should people do?' },
  { key: 'level', label: 'Severity level', type: 'select', required: true, options: asOptions(BROADCAST_LEVELS) },
  { key: 'status', label: 'Status', type: 'select', required: true, options: asOptions(BROADCAST_STATUSES) },
  { key: 'zones', label: 'Target zones', type: 'multi', span: 2, options: asOptions(ZONES) },
  { key: 'channels', label: 'Delivery channels', type: 'multi', span: 2, options: asOptions(CHANNELS) },
  { key: 'recipients', label: 'Estimated recipients', type: 'number', min: 0 },
];

const columns: TableColumn[] = [
  { key: 'title', label: 'Broadcast', width: '32%', render: (row) => <div className="entity-cell"><span className={`entity-icon tone-${row.level === 'critical' ? 'red' : row.level === 'warning' ? 'amber' : 'blue'}`}><Megaphone size={15} /></span><div><strong>{row.title}</strong><span className="cell-sub">{row.body?.slice(0, 70)}…</span></div></div> },
  { key: 'level', label: 'Level', render: (row) => <LevelBadge level={row.level} /> },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'sent' ? 'green' : row.status === 'draft' ? 'amber' : 'slate'} dot>{row.status}</Badge> },
  { key: 'recipients', label: 'Reach', render: (row) => <span className="mono">{formatNumber(row.recipients)}</span> },
  { key: 'zones', label: 'Zones', render: (row) => <span className="cell-sub">{(row.zones || []).slice(0, 2).join(', ') || 'All zones'}</span> },
  { key: 'created_at', label: 'Published', render: (row) => timeAgo(row.created_at) },
];

export function Broadcasts() {
  const { data, loading, can } = useApp();
  const sent = data.broadcasts.filter((broadcast) => broadcast.status === 'sent');
  const critical = data.broadcasts.filter((broadcast) => broadcast.level === 'critical');
  const reach = data.broadcasts.reduce((sum, broadcast) => sum + Number(broadcast.recipients || 0), 0);
  const featured = critical[0] || sent[0];

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Broadcasts sent" value={sent.length} icon={Send} tone="green" hint="Across all channels" loading={loading.broadcasts} />
        <StatCard label="Critical alerts" value={critical.length} icon={ShieldAlert} tone="red" hint="Immediate action required" loading={loading.broadcasts} />
        <StatCard label="Total reach" value={formatNumber(reach)} icon={Radio} tone="blue" hint="Estimated recipients" loading={loading.broadcasts} />
        <StatCard label="Draft messages" value={data.broadcasts.filter((item) => item.status === 'draft').length} icon={BellRing} tone="amber" hint="Awaiting approval" loading={loading.broadcasts} />
      </div>

      {featured && (
        <Card className={`featured-alert featured-${featured.level}`}>
          <div className="featured-icon"><ShieldAlert size={24} /></div>
          <div className="featured-body">
            <div className="featured-head"><LevelBadge level={featured.level} /><span>{timeAgo(featured.created_at)} · by {featured.author_name || 'Command'}</span></div>
            <h2>{featured.title}</h2>
            <p>{featured.body}</p>
            <div className="featured-meta"><span>Zones: {(featured.zones || []).join(', ') || 'All'}</span><span>Channels: {(featured.channels || []).join(', ')}</span><span>{formatNumber(featured.recipients)} recipients</span></div>
          </div>
        </Card>
      )}

      <div className="broadcast-grid">
        {sent.slice(0, 4).map((broadcast) => (
          <Card className="broadcast-card" key={broadcast.id}>
            <div className="broadcast-card-head"><LevelBadge level={broadcast.level} /><span>{timeAgo(broadcast.created_at)}</span></div>
            <h3>{broadcast.title}</h3>
            <p>{broadcast.body}</p>
            <div className="broadcast-card-foot"><span>{formatNumber(broadcast.recipients)} reached</span><span>{(broadcast.zones || []).length} zones</span></div>
          </Card>
        ))}
        {sent.length === 0 && <Card><EmptyState icon={Megaphone} title="No published alerts" description={can('broadcast:manage') ? 'Create the first advisory below.' : 'Official advisories will appear here.'} /></Card>}
      </div>

      {can('broadcast:manage') ? (
        <ResourceManager
          resource="broadcasts"
          title="Broadcast manager"
          subtitle="Create, schedule, edit and archive public advisories"
          icon={Megaphone}
          columns={columns}
          fields={fields}
          filters={[
            { key: 'level', label: 'Level', options: asOptions(BROADCAST_LEVELS) },
            { key: 'status', label: 'Status', options: asOptions(BROADCAST_STATUSES) },
          ]}
          defaultValues={{ level: 'advisory', status: 'sent', recipients: 0, zones: [], channels: ['app', 'sms'] }}
          emptyTitle="No broadcasts found"
        />
      ) : (
        <Card><CardHead title="Public advisories" subtitle="Official messages from the disaster management authority" icon={BellRing} tone="blue" /><div className="public-alert-list">{sent.map((item) => <div key={item.id} className="public-alert-row"><LevelBadge level={item.level} /><div><strong>{item.title}</strong><p>{item.body}</p></div><span>{timeAgo(item.created_at)}</span></div>)}</div></Card>
      )}
    </div>
  );
}
