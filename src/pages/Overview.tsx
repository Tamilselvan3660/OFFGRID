import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, BedDouble, BellRing, Bot,
  BrainCircuit, CheckCircle2, Clock3, Download, Flame, GitMerge, HeartPulse,
  MapPin, Megaphone, Radio, ShieldAlert, Siren, Sparkles, TrendingUp, Truck,
  Users, WifiOff, Zap,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { formatNumber, minutesLabel, relativeDue, timeAgo, titleCase } from '../lib/format';
import {
  Badge, Button, Card, CardHead, EmptyState, PriorityMeter, ProgressBar, SeverityBadge,
  Skeleton, SkeletonCards, SkeletonRows, StatCard, StatusBadge,
} from '../components/ui';
import { IncidentMap } from '../components/IncidentMap';

const chartTooltip = {
  contentStyle: { background: '#fff', border: '1px solid #e6eaf0', borderRadius: 10, boxShadow: '0 12px 30px rgba(16,25,37,.12)', fontSize: 12 },
  labelStyle: { color: '#6b7788', fontWeight: 600 },
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function Overview() {
  const { user } = useApp();
  if (user?.role === 'citizen') return <CitizenOverview />;
  return <CommandOverview />;
}

function CommandOverview() {
  const {
    user, data, loading, setSosOpen, simulateSos, setOpenIncidentId,
    sseConnected, lastEventAt, isOffline, can,
  } = useApp();
  const navigate = useNavigate();
  const kpis = data.analytics?.kpis || {};
  const activeIncidents = useMemo(
    () => data.incidents
      .filter((incident) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status) && incident.status !== 'duplicate')
      .sort((a, b) => b.priority_score - a.priority_score),
    [data.incidents],
  );
  const duplicates = data.incidents.filter((incident) => incident.duplicate_of && incident.status !== 'duplicate');
  const lowStock = data.resources.filter((resource) => Number(resource.quantity) <= Number(resource.threshold));

  const activityIcon = (type: string) => {
    const icons: Record<string, any> = { incident: Siren, allocation: BrainCircuit, dispatch: Truck, duplicate: GitMerge, hospital: HeartPulse, broadcast: Megaphone, message: Activity, resource: AlertTriangle, resolved: CheckCircle2, status: Activity, team: Users, delete: AlertTriangle, create: CheckCircle2, update: CheckCircle2 };
    return icons[type] || Activity;
  };

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-eyebrow"><span className={`pulse-dot ${sseConnected && !isOffline ? 'live' : 'offline'}`} /> LIVE COMMAND VIEW <span className="hero-divider">/</span> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <h2>{greeting()}, {user?.name?.split(' ')[0]}.</h2>
          <p>{activeIncidents.length} active incidents across 7 zones · {data.teams.filter((team) => team.status === 'deployed').length} teams deployed · {formatNumber(kpis.bedAvailable)} hospital beds available.</p>
          <div className="hero-insight"><Sparkles size={15} /><span>AI insight: {duplicates.length} possible duplicate{duplicates.length === 1 ? '' : 's'} flagged, {lowStock.length} resources below threshold.</span></div>
        </div>
        <div className="hero-actions">
          <Button variant="danger" size="lg" icon={Siren} onClick={() => setSosOpen(true)}>Raise SOS</Button>
          <Button variant="outline-light" icon={Zap} onClick={simulateSos}>Simulate incoming SOS</Button>
          <button className="hero-link" onClick={() => navigate('/analytics')}>View analytics <ArrowUpRight size={14} /></button>
        </div>
      </section>

      {loading.analytics || loading.incidents ? <SkeletonCards count={6} /> : (
        <div className="stats-grid">
          <StatCard label="Active incidents" value={formatNumber(kpis.activeIncidents)} icon={Siren} tone="orange" hint="Across all zones" delta="+12%" onClick={() => navigate('/incidents')} />
          <StatCard label="Critical priority" value={formatNumber(kpis.criticalIncidents)} icon={ShieldAlert} tone="red" hint="Severity S4–S5" onClick={() => navigate('/incidents')} />
          <StatCard label="Avg. response" value={minutesLabel(kpis.avgResponseMinutes || 0)} icon={Clock3} tone="blue" hint="First acknowledgement" delta="-8%" />
          <StatCard label="Teams deployed" value={`${kpis.teamsDeployed || 0}/${data.teams.length}`} icon={Truck} tone="teal" hint={`${kpis.teamUtilisation || 0}% utilisation`} onClick={() => navigate('/teams')} />
          <StatCard label="Beds available" value={formatNumber(kpis.bedAvailable)} icon={BedDouble} tone="violet" hint={`${kpis.bedOccupancy || 0}% occupancy`} onClick={() => navigate('/hospitals')} />
          <StatCard label="People affected" value={formatNumber(kpis.peopleAffected)} icon={Users} tone="amber" hint="Cumulative this season" />
        </div>
      )}

      <div className="overview-grid">
        <Card className="overview-map-card">
          <CardHead
            title="Live incident map"
            subtitle="Incidents, rescue teams and hospitals · GPS positions update in real time"
            icon={MapPin}
            tone="teal"
            action={<div className="row gap-8"><Badge tone="green" dot>Live telemetry</Badge><Button size="sm" variant="ghost" onClick={() => navigate('/map')}>Open map <ArrowUpRight size={13} /></Button></div>}
          />
          {loading.incidents ? <Skeleton height={380} /> : (
            <IncidentMap activeOnly height={390} selectedId={undefined} onSelect={(id) => typeof id === 'number' && setOpenIncidentId(id)} />
          )}
          <div className="map-card-foot">
            <span><Radio size={13} /> {sseConnected ? 'Streaming live updates' : 'Reconnecting to event stream'}</span>
            <span>Last event {lastEventAt ? timeAgo(lastEventAt) : '—'}</span>
          </div>
        </Card>

        <Card className="priority-card">
          <CardHead title="Priority triage queue" subtitle="Ranked by severity, exposure and SLA" icon={Flame} tone="orange" action={<Button size="sm" variant="ghost" onClick={() => navigate('/incidents')}>View all</Button>} />
          {loading.incidents ? <div className="priority-list"><SkeletonRows rows={5} cols={2} /></div> : activeIncidents.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Queue is clear" description="No active incidents require triage right now." />
          ) : (
            <div className="priority-list">
              {activeIncidents.slice(0, 6).map((incident) => (
                <button className="priority-row" key={incident.id} onClick={() => typeof incident.id === 'number' && setOpenIncidentId(incident.id)}>
                  <div className="priority-row-top">
                    <span className="priority-code mono">{incident.code}</span>
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  <strong>{incident.title}</strong>
                  <div className="priority-row-meta"><span><MapPin size={11} /> {incident.zone}</span><span>{relativeDue(incident.created_at, incident.sla_minutes || 20)}</span></div>
                  <PriorityMeter score={incident.priority_score} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="overview-grid-3">
        <Card className="activity-card">
          <CardHead title="Live activity" subtitle="Network-wide event stream" icon={Activity} tone="blue" action={<Badge tone="green" dot>Live</Badge>} />
          {loading.activity ? <SkeletonRows rows={6} cols={2} /> : (
            <div className="activity-list">
              {data.activity.slice(0, 7).map((item) => {
                const Icon = activityIcon(item.type);
                return (
                  <div className="activity-item" key={item.id}>
                    <span className={`activity-icon tone-${item.type === 'duplicate' ? 'violet' : item.type === 'resolved' ? 'green' : 'blue'}`}><Icon size={14} /></span>
                    <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.actor_name} · {timeAgo(item.created_at)}</small></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="category-card">
          <CardHead title="Incident mix" subtitle="AI-classified categories" icon={BarChart3} tone="violet" />
          {loading.analytics || !data.analytics ? <Skeleton height={200} /> : (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={data.analytics.categoryBreakdown} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                      {data.analytics.categoryBreakdown.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                    </Pie>
                    <ChartTooltip {...chartTooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{data.incidents.length}</strong><span>reports</span></div>
              </div>
              <div className="category-legend">
                {data.analytics.categoryBreakdown.slice(0, 5).map((entry) => (
                  <div key={entry.key}><span className="legend-color" style={{ background: entry.color }} /> <span>{entry.name}</span><strong>{entry.value}</strong></div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="capacity-card">
          <CardHead title="Zone pressure" subtitle="Active incidents by operating zone" icon={MapPin} tone="amber" />
          {loading.analytics || !data.analytics ? <Skeleton height={220} /> : (
            <div className="zone-pressure">
              {data.analytics.zoneLoad.slice(0, 6).map((zone) => (
                <div className="zone-pressure-row" key={zone.zone}>
                  <div className="zone-pressure-head"><strong>{zone.zone}</strong><span>{zone.active} active · {zone.critical} critical</span></div>
                  <ProgressBar value={zone.active} max={Math.max(4, ...data.analytics!.zoneLoad.map((item) => item.active))} tone={zone.critical >= 2 ? 'red' : zone.active >= 3 ? 'orange' : 'teal'} height={7} />
                </div>
              ))}
              <div className="capacity-alert"><AlertTriangle size={15} /><span>{lowStock.length} inventory items below threshold — review resource allocation.</span><button onClick={() => navigate('/resources')}>Review</button></div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHead
          title="14-day incident trend"
          subtitle="Reported vs resolved emergencies"
          icon={TrendingUp}
          tone="teal"
          action={<Button size="sm" variant="ghost" icon={Download} onClick={() => window.open('/api/export/incidents.csv', '_blank')}>Export CSV</Button>}
        />
        {loading.analytics || !data.analytics ? <Skeleton height={230} /> : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.analytics.trend} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f26430" stopOpacity={0.3} /><stop offset="100%" stopColor="#f26430" stopOpacity={0} /></linearGradient>
                  <linearGradient id="resolvedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f9b8e" stopOpacity={0.25} /><stop offset="100%" stopColor="#0f9b8e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="#eef1f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#8a95a5', fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#8a95a5', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ChartTooltip {...chartTooltip} />
                <Area type="monotone" dataKey="reported" name="Reported" stroke="#f26430" strokeWidth={2.4} fill="url(#reportedFill)" dot={false} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#0f9b8e" strokeWidth={2.4} fill="url(#resolvedFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="chart-legend"><span><i className="legend-dot" style={{ background: '#f26430' }} /> Reported</span><span><i className="legend-dot" style={{ background: '#0f9b8e' }} /> Resolved</span></div>
          </div>
        )}
      </Card>
    </div>
  );
}

function CitizenOverview() {
  const { user, data, loading, setSosOpen, setOpenIncidentId, queue, isOffline } = useApp();
  const navigate = useNavigate();
  const myReports = data.incidents;
  const active = myReports.filter((incident) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status));
  const resolved = myReports.filter((incident) => ['resolved', 'closed'].includes(incident.status));
  const alerts = data.broadcasts.filter((broadcast) => broadcast.status === 'sent');

  return (
    <div className="page-stack">
      <section className="hero-card citizen-hero">
        <div className="hero-grid-bg" />
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="pulse-dot live" /> CITIZEN PORTAL <span className="hero-divider">/</span> {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          <h2>{greeting()}, {user?.name?.split(' ')[0]}.</h2>
          <p>Your safety network is ready. Report an emergency, share your GPS location and track responders in real time — even without connectivity.</p>
          <div className="hero-insight"><ShieldAlert size={15} /><span>Emergency helpline 112 · District disaster helpline 1070</span></div>
        </div>
        <div className="hero-actions">
          <Button variant="danger" size="lg" icon={Siren} onClick={() => setSosOpen(true)}>Send SOS</Button>
          <Button variant="outline-light" icon={WifiOff} onClick={() => navigate('/settings')}>{isOffline ? 'Offline mode on' : 'Offline ready'}</Button>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard label="My reports" value={myReports.length} icon={Siren} tone="orange" hint="All time" onClick={() => navigate('/incidents')} />
        <StatCard label="Active cases" value={active.length} icon={Activity} tone="blue" hint="Being coordinated" />
        <StatCard label="Resolved" value={resolved.length} icon={CheckCircle2} tone="green" hint="Closed by responders" />
        <StatCard label="Queued offline" value={queue.length} icon={WifiOff} tone="violet" hint="Auto-sync when online" onClick={() => navigate('/settings')} />
      </div>

      <div className="overview-grid">
        <Card className="citizen-sos-card">
          <div className="citizen-sos-inner">
            <span className="citizen-sos-icon"><Siren size={30} /></span>
            <h2>Need help right now?</h2>
            <p>One tap sends your live GPS position, classifies the emergency with AI and alerts the nearest rescue team.</p>
            <Button variant="danger" size="lg" icon={Radio} onClick={() => setSosOpen(true)}>One-tap SOS</Button>
            <div className="citizen-sos-features"><span><CheckCircle2 size={13} /> GPS sharing</span><span><CheckCircle2 size={13} /> AI triage</span><span><CheckCircle2 size={13} /> Works offline</span></div>
          </div>
        </Card>

        <Card>
          <CardHead title="My recent reports" subtitle="Live status of your incidents" icon={Activity} tone="blue" action={<Button size="sm" variant="ghost" onClick={() => navigate('/incidents')}>View all</Button>} />
          {loading.incidents ? <SkeletonRows rows={4} cols={2} /> : myReports.length === 0 ? (
            <EmptyState icon={Siren} title="No reports yet" description="Your emergency reports will appear here." action={<Button variant="primary" onClick={() => setSosOpen(true)}>Create a report</Button>} />
          ) : (
            <div className="priority-list">
              {myReports.slice(0, 5).map((incident) => (
                <button className="priority-row" key={incident.id} onClick={() => typeof incident.id === 'number' && setOpenIncidentId(incident.id)}>
                  <div className="priority-row-top"><span className="priority-code mono">{incident.code}</span><StatusBadge status={incident.status} /></div>
                  <strong>{incident.title}</strong>
                  <div className="priority-row-meta"><span><MapPin size={11} /> {incident.zone}</span><span>{timeAgo(incident.created_at)}</span></div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="overview-grid">
        <Card>
          <CardHead title="Public advisories" subtitle="Broadcasts from the disaster authority" icon={Megaphone} tone="amber" action={<Button size="sm" variant="ghost" onClick={() => navigate('/broadcasts')}>All alerts</Button>} />
          {alerts.length === 0 ? <EmptyState icon={BellRing} title="No advisories" description="Official alerts will appear here." /> : (
            <div className="alert-list">
              {alerts.slice(0, 4).map((alert) => (
                <div className="alert-row" key={alert.id}>
                  <span className={`alert-level level-${alert.level}`}>{alert.level}</span>
                  <div><strong>{alert.title}</strong><p>{alert.body}</p><small>{timeAgo(alert.created_at)} · {titleCase(alert.zones?.[0])}</small></div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHead title="Your operating map" subtitle="Locations you have shared with responders" icon={MapPin} tone="teal" />
          <IncidentMap incidents={myReports} showTeams={false} showHospitals height={300} onSelect={(id) => typeof id === 'number' && setOpenIncidentId(id)} />
        </Card>
      </div>
    </div>
  );
}
