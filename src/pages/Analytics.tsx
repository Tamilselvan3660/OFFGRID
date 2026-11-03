import React, { useState } from 'react';
import {
  Activity, BarChart3, BedDouble, BrainCircuit, CheckCircle2, Clock3, Download,
  GitMerge, ShieldAlert, TrendingUp, Truck, Users,
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { formatNumber, minutesLabel } from '../lib/format';
import { Badge, Button, Card, CardHead, ProgressBar, Skeleton, SkeletonCards, StatCard, Tabs } from '../components/ui';

const tooltipStyle = {
  contentStyle: { background: '#fff', border: '1px solid #e6eaf0', borderRadius: 10, boxShadow: '0 12px 30px rgba(16,25,37,.12)', fontSize: 12 },
};

export function Analytics() {
  const { data, loading } = useApp();
  const [range, setRange] = useState('14');
  const analytics = data.analytics;
  const kpis = analytics?.kpis || {};
  const trend = analytics?.trend.slice(-Number(range)) || [];
  const resolutionRate = kpis.totalIncidents ? Math.round((kpis.resolvedIncidents / kpis.totalIncidents) * 100) : 0;

  return (
    <div className="page-stack">
      <Card className="analytics-head-card">
        <div><CardHead title="Operational performance" subtitle="Live metrics computed from persisted incident, team and hospital records" icon={TrendingUp} tone="teal" /></div>
        <div className="row gap-8 wrap">
          <Tabs tabs={[{ id: '7', label: '7 days' }, { id: '14', label: '14 days' }]} active={range} onChange={setRange} />
          <Button variant="ghost" size="sm" icon={Download} onClick={() => window.open('/api/export/incidents.csv', '_blank')}>Export CSV</Button>
        </div>
      </Card>

      {loading.analytics || !analytics ? <SkeletonCards count={6} /> : (
        <div className="stats-grid">
          <StatCard label="Total incidents" value={formatNumber(kpis.totalIncidents)} icon={Activity} tone="blue" hint="All time in workspace" />
          <StatCard label="Resolution rate" value={`${resolutionRate}%`} icon={CheckCircle2} tone="green" hint={`${kpis.resolvedIncidents} resolved / closed`} />
          <StatCard label="Avg. first response" value={minutesLabel(kpis.avgResponseMinutes)} icon={Clock3} tone="orange" hint="Report → acknowledgement" />
          <StatCard label="Avg. resolution" value={minutesLabel(kpis.avgResolutionMinutes)} icon={TrendingUp} tone="teal" hint="Report → resolution" />
          <StatCard label="SLA compliance" value={`${kpis.slaCompliance}%`} icon={ShieldAlert} tone="violet" hint="Acknowledged within 20 min" />
          <StatCard label="Duplicates caught" value={kpis.duplicatesFlagged} icon={GitMerge} tone="amber" hint="Prevented double dispatch" />
        </div>
      )}

      <div className="analytics-grid">
        <Card className="span-2-card">
          <CardHead title="Incident volume" subtitle="Reported vs resolved emergencies" icon={BarChart3} tone="orange" />
          {loading.analytics || !analytics ? <Skeleton height={270} /> : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={trend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }} barGap={3}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#eef1f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8a95a5', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8a95a5', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <ChartTooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="reported" name="Reported" fill="#f26430" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#0f9b8e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Severity distribution" subtitle="Classified by the AI engine" icon={ShieldAlert} tone="red" />
          {loading.analytics || !analytics ? <Skeleton height={270} /> : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={analytics.severityDistribution} layout="vertical" margin={{ top: 8, right: 16, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke="#eef1f5" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#8a95a5', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#6b7788', fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <ChartTooltip {...tooltipStyle} />
                  <Bar dataKey="value" name="Incidents" radius={[0, 5, 5, 0]}>
                    {analytics.severityDistribution.map((entry, index) => <Cell key={entry.name} fill={['#3b7ff5', '#0f9b8e', '#e9a426', '#f26430', '#dc3b45'][index]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="analytics-grid-3">
        <Card>
          <CardHead title="Category breakdown" subtitle="Where demand is concentrated" icon={BrainCircuit} tone="violet" />
          {loading.analytics || !analytics ? <Skeleton height={220} /> : (
            <>
              <div className="donut-wrap small">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={analytics.categoryBreakdown} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                      {analytics.categoryBreakdown.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                    </Pie>
                    <ChartTooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center"><strong>{analytics.categoryBreakdown.length}</strong><span>categories</span></div>
              </div>
              <div className="category-legend">
                {analytics.categoryBreakdown.map((entry) => <div key={entry.key}><span className="legend-color" style={{ background: entry.color }} /><span>{entry.name}</span><strong>{entry.value}</strong></div>)}
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHead title="Zone demand" subtitle="Active and critical incidents" icon={Activity} tone="orange" />
          {loading.analytics || !analytics ? <Skeleton height={250} /> : (
            <div className="zone-analytics">
              {analytics.zoneLoad.map((zone) => (
                <div key={zone.zone} className="zone-analytics-row">
                  <div><strong>{zone.zone}</strong><small>{zone.total} total · {zone.critical} critical</small></div>
                  <ProgressBar value={zone.active} max={Math.max(3, ...analytics.zoneLoad.map((item) => item.active))} tone={zone.critical >= 2 ? 'red' : 'teal'} height={7} label={`${zone.active} active`} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Team workload" subtitle="Active missions vs capacity" icon={Truck} tone="blue" />
          {loading.analytics || !analytics ? <Skeleton height={250} /> : (
            <div className="zone-analytics">
              {analytics.teamWorkload.map((team) => (
                <div key={team.name} className="zone-analytics-row">
                  <div><strong className="mono">{team.name}</strong><small>{team.status}</small></div>
                  <ProgressBar value={team.active} max={team.capacity || 4} tone={team.active >= team.capacity ? 'red' : 'blue'} height={7} label={`${team.active}/${team.capacity}`} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="analytics-grid">
        <Card>
          <CardHead title="AI-generated insights" subtitle="Explainable findings from live operational data" icon={BrainCircuit} tone="violet" />
          <div className="insight-list">
            {[
              { tone: 'red', icon: ShieldAlert, title: `${kpis.criticalIncidents || 0} critical incidents are active`, text: 'Severity S4–S5 reports should be acknowledged first; the triage queue ranks them above all others.' },
              { tone: 'amber', icon: GitMerge, title: `${kpis.duplicatesFlagged || 0} duplicate reports detected`, text: 'Text similarity, distance and time-window matching prevented redundant team dispatch.' },
              { tone: 'teal', icon: Clock3, title: `${kpis.slaCompliance || 0}% SLA compliance`, text: `Average first acknowledgement is ${minutesLabel(kpis.avgResponseMinutes)} against a 20-minute service target.` },
              { tone: 'blue', icon: BedDouble, title: `${kpis.bedOccupancy || 0}% network bed occupancy`, text: `${formatNumber(kpis.icuAvailable)} ICU beds remain available for incoming critical patients.` },
              { tone: 'orange', icon: Truck, title: `${kpis.teamUtilisation || 0}% team utilisation`, text: `${kpis.teamsDeployed || 0} units are deployed; rebalancing can reduce response times in high-demand zones.` },
            ].map((insight) => {
              const Icon = insight.icon;
              return (
                <div className="insight-row" key={insight.title}>
                  <span className={`insight-icon tone-${insight.tone}`}><Icon size={16} /></span>
                  <div><strong>{insight.title}</strong><p>{insight.text}</p></div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead title="Network capacity" subtitle="Hospital readiness and resource health" icon={BedDouble} tone="teal" />
          {loading.hospitals || loading.resources ? <Skeleton height={250} /> : (
            <div className="capacity-analytics">
              <div className="capacity-gauge">
                <div className="gauge-value">{kpis.bedOccupancy || 0}%</div>
                <span>Network bed occupancy</span>
                <ProgressBar value={kpis.bedOccupancy || 0} tone={(kpis.bedOccupancy || 0) > 85 ? 'red' : 'teal'} height={8} />
              </div>
              <div className="capacity-stats">
                <div><span>Beds available</span><strong>{formatNumber(kpis.bedAvailable)}</strong></div>
                <div><span>ICU available</span><strong>{formatNumber(kpis.icuAvailable)}</strong></div>
                <div><span>Low-stock items</span><strong>{kpis.lowStockItems}</strong></div>
                <div><span>Messages exchanged</span><strong>{formatNumber(kpis.messagesExchanged)}</strong></div>
              </div>
              <div className="hospital-mini-list">
                {data.hospitals.slice(0, 5).map((hospital) => (
                  <div key={hospital.id}>
                    <div><strong>{hospital.code}</strong><span>{hospital.beds_available}/{hospital.beds_total} beds</span></div>
                    <ProgressBar value={hospital.beds_available} max={hospital.beds_total || 1} tone={hospital.beds_available / (hospital.beds_total || 1) < 0.15 ? 'red' : 'teal'} height={5} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
