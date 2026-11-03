import React, { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, Compass, Sparkles, Truck, UsersRound, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { get } from '../lib/api';
import { ZONES } from '../lib/geo';
import { TEAM_STATUSES, TEAM_TYPES, asOptions } from '../lib/constants';
import {
  Badge, Button, Card, CardHead, EmptyState, ProgressBar, Select, Skeleton,
  StatCard,
} from '../components/ui';
import { ResourceManager, type FormField, type TableColumn } from '../components/ResourceManager';

const fields: FormField[] = [
  { key: 'name', label: 'Team name', type: 'text', required: true, placeholder: 'Alpha-1 Swift Water Rescue', span: 2 },
  { key: 'code', label: 'Call sign / code', type: 'text', required: true, placeholder: 'ALP-01' },
  { key: 'type', label: 'Speciality', type: 'select', required: true, options: asOptions(TEAM_TYPES) },
  { key: 'zone', label: 'Home zone', type: 'select', options: asOptions(ZONES) },
  { key: 'leader_name', label: 'Team leader', type: 'text', placeholder: 'Full name' },
  { key: 'status', label: 'Availability', type: 'select', options: asOptions(TEAM_STATUSES) },
  { key: 'capacity', label: 'Incident capacity', type: 'number', min: 1, max: 100 },
  { key: 'members', label: 'Team members', type: 'number', min: 0, max: 500 },
  { key: 'latitude', label: 'Base latitude', type: 'number', step: '0.00001' },
  { key: 'longitude', label: 'Base longitude', type: 'number', step: '0.00001' },
  { key: 'contact', label: 'Contact number', type: 'text', placeholder: '+91 …' },
  { key: 'skills', label: 'Skills (comma separated)', type: 'tags', span: 2, placeholder: 'flood rescue, boat operations' },
  { key: 'equipment', label: 'Equipment (comma separated)', type: 'tags', span: 2, placeholder: 'Inflatable boats, life jackets' },
];

const columns: TableColumn[] = [
  {
    key: 'name', label: 'Team', width: '22%',
    render: (row) => (
      <div className="entity-cell"><span className={`entity-icon tone-${row.status === 'deployed' ? 'orange' : 'blue'}`}><UsersRound size={15} /></span><div><strong>{row.name}</strong><span className="mono cell-sub">{row.code}</span></div></div>
    ),
  },
  { key: 'type', label: 'Speciality', render: (row) => <Badge tone="blue">{row.type}</Badge> },
  { key: 'zone', label: 'Zone' },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'available' ? 'green' : row.status === 'deployed' ? 'orange' : row.status === 'standby' ? 'blue' : 'slate'} dot>{row.status}</Badge> },
  {
    key: 'active_incidents', label: 'Workload',
    render: (row) => <div className="workload-cell"><ProgressBar value={row.active_incidents} max={row.capacity || 4} tone={row.active_incidents >= row.capacity ? 'red' : 'teal'} height={5} /><span>{row.active_incidents}/{row.capacity}</span></div>,
  },
  { key: 'leader_name', label: 'Leader' },
];

export function Teams() {
  const { data, loading, allocate, can, setOpenIncidentId } = useApp();
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  const candidates = useMemo(
    () => data.incidents
      .filter((incident) => typeof incident.id === 'number' && ['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status))
      .sort((a, b) => b.priority_score - a.priority_score),
    [data.incidents],
  );

  useEffect(() => {
    if (!incidentId && candidates.length) setIncidentId(candidates[0].id as number);
  }, [candidates, incidentId]);

  const runAllocation = async () => {
    if (!incidentId) return;
    setRecLoading(true);
    try {
      const result = await get(`/incidents/${incidentId}/recommendations`);
      setRecommendations(result.recommendations || []);
    } catch { setRecommendations([]); }
    finally { setRecLoading(false); }
  };

  useEffect(() => { if (incidentId) runAllocation(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [incidentId]);

  const stats = {
    available: data.teams.filter((team) => team.status === 'available').length,
    deployed: data.teams.filter((team) => team.status === 'deployed').length,
    standby: data.teams.filter((team) => team.status === 'standby').length,
    utilisation: data.teams.length ? Math.round((data.teams.reduce((sum, team) => sum + (team.active_incidents || 0), 0) / data.teams.reduce((sum, team) => sum + (team.capacity || 1), 0)) * 100) : 0,
  };

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Total teams" value={data.teams.length} icon={UsersRound} tone="blue" hint="Across 7 zones" loading={loading.teams} />
        <StatCard label="Available now" value={stats.available} icon={Zap} tone="green" hint="Ready to dispatch" loading={loading.teams} />
        <StatCard label="Deployed" value={stats.deployed} icon={Truck} tone="orange" hint="Active missions" loading={loading.teams} />
        <StatCard label="Fleet utilisation" value={`${stats.utilisation}%`} icon={Compass} tone="violet" hint="Incidents vs capacity" loading={loading.teams} />
      </div>

      <Card className="allocation-console">
        <CardHead
          title="Intelligent allocation console"
          subtitle="Ranked by speciality match, proximity, availability and current workload"
          icon={BrainCircuit}
          tone="violet"
          action={<Button size="sm" variant="outline" icon={Sparkles} loading={recLoading} onClick={runAllocation}>Re-rank teams</Button>}
        />
        <div className="allocation-body">
          <div className="allocation-input">
            <span className="field-label">Choose an incident</span>
            <Select value={incidentId ?? ''} onChange={(event) => setIncidentId(Number(event.target.value))}>
              {candidates.map((incident) => <option key={incident.id} value={incident.id}>{incident.code} · {incident.title.slice(0, 52)}</option>)}
            </Select>
            <div className="allocation-hint"><BrainCircuit size={14} /><span>The engine explains every ranking decision so dispatchers stay in control.</span></div>
            {incidentId && (
              <Button variant="ghost" size="sm" onClick={() => setOpenIncidentId(incidentId)}>Open incident record</Button>
            )}
            {can('incident:assign') && (
              <Button variant="primary" icon={Sparkles} disabled={!incidentId} onClick={() => incidentId && allocate(incidentId)} className="full-width">Auto-assign best team</Button>
            )}
          </div>
          <div className="allocation-results">
            {recLoading ? (
              <div className="rec-loading"><Skeleton height={62} /><Skeleton height={62} /><Skeleton height={62} /></div>
            ) : recommendations.length === 0 ? (
              <EmptyState icon={Truck} title="No recommendations yet" description="Choose an incident and run the allocation engine." />
            ) : recommendations.slice(0, 4).map((team, index) => (
              <div className={`allocation-result ${index === 0 ? 'top' : ''}`} key={team.id}>
                <span className="allocation-rank">#{index + 1}</span>
                <div className="allocation-result-main">
                  <div className="allocation-result-head"><strong>{team.code} · {team.name}</strong><Badge tone={index === 0 ? 'teal' : 'blue'}>Score {team.score}</Badge></div>
                  <small>{team.reasons.join(' · ')}</small>
                </div>
                <div className="allocation-result-meta"><strong>{team.etaMinutes} min</strong><span>{team.distanceKm} km</span></div>
                {can('incident:assign') && <Button size="sm" variant={index === 0 ? 'primary' : 'ghost'} onClick={() => incidentId && allocate(incidentId, team.id)}>Assign</Button>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <ResourceManager
        resource="teams"
        title="Rescue teams"
        subtitle="Create, update and remove field units and their capabilities"
        icon={UsersRound}
        columns={columns}
        fields={fields}
        filters={[
          { key: 'status', label: 'Status', options: asOptions(TEAM_STATUSES) },
          { key: 'type', label: 'Speciality', options: asOptions(TEAM_TYPES) },
          { key: 'zone', label: 'Zone', options: asOptions(ZONES) },
        ]}
        defaultValues={{ status: 'available', capacity: 4, members: 4, latitude: 13.072, longitude: 80.251 }}
        emptyTitle="No rescue teams yet"
        createLabel="New team"
      />
    </div>
  );
}
