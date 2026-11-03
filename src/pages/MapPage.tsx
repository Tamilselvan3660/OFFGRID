import React, { useMemo, useState } from 'react';
import {
  Activity, BedDouble, Building2, Crosshair, Layers, MapPin, Radio, Truck, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { timeAgo } from '../lib/format';
import { Badge, Button, Card, CardHead, EmptyState, ProgressBar, Select, SeverityBadge, StatusBadge, Toggle } from '../components/ui';
import { IncidentMap } from '../components/IncidentMap';

export function MapPage() {
  const { data, setOpenIncidentId, sseConnected, lastEventAt } = useApp();
  const [activeOnly, setActiveOnly] = useState(true);
  const [showTeams, setShowTeams] = useState(true);
  const [showHospitals, setShowHospitals] = useState(true);
  const [zone, setZone] = useState('all');
  const [selectedId, setSelectedId] = useState<number | string | null>(null);

  const incidents = useMemo(
    () => data.incidents.filter((incident) => {
      if (zone !== 'all' && incident.zone !== zone) return false;
      if (activeOnly && !['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status)) return false;
      return true;
    }).sort((a, b) => b.priority_score - a.priority_score),
    [data.incidents, activeOnly, zone],
  );
  const selected = data.incidents.find((incident) => String(incident.id) === String(selectedId));
  const teamList = data.teams.filter((team) => zone === 'all' || team.zone === zone);
  const hospitalList = data.hospitals.filter((hospital) => zone === 'all' || hospital.zone === zone);

  return (
    <div className="map-page">
      <Card className="map-controls">
        <div className="map-controls-row">
          <div className="map-control-title"><span className="map-control-icon"><Layers size={17} /></span><div><strong>Map layers</strong><small>{incidents.length} incidents · {teamList.length} teams · {hospitalList.length} hospitals</small></div></div>
          <div className="map-control-filters">
            <div className="filter-select"><Select value={zone} onChange={(event) => setZone(event.target.value)}><option value="all">All zones</option>{ZONES.map((item) => <option key={item}>{item}</option>)}</Select></div>
            <label className="map-toggle"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} /> Active only</label>
            <label className="map-toggle"><input type="checkbox" checked={showTeams} onChange={(event) => setShowTeams(event.target.checked)} /> Teams</label>
            <label className="map-toggle"><input type="checkbox" checked={showHospitals} onChange={(event) => setShowHospitals(event.target.checked)} /> Hospitals</label>
          </div>
          <div className={`live-pill ${sseConnected ? 'live' : 'degraded'}`}><span className="pulse-dot" /> {sseConnected ? 'LIVE' : 'SYNCING'}</div>
        </div>
      </Card>

      <div className="map-layout">
        <Card className="map-main-card">
          <IncidentMap
            incidents={incidents}
            teams={teamList}
            hospitals={hospitalList}
            showTeams={showTeams}
            showHospitals={showHospitals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            height={600}
          />
          <div className="map-main-foot"><span><Radio size={13} /> Telemetry updates every 9 seconds</span><span>Last event {lastEventAt ? timeAgo(lastEventAt) : '—'}</span></div>
        </Card>

        <div className="map-side">
          <Card className="map-selected-card">
            <CardHead title="Selected location" subtitle={selected ? 'Incident details' : 'Click a marker on the map'} icon={Crosshair} tone="orange" />
            {!selected ? (
              <EmptyState icon={MapPin} title="No marker selected" description="Select an incident pin to see live details and open the full incident record." />
            ) : (
              <div className="selected-detail">
                <div className="selected-code"><span className="mono">{selected.code}</span><SeverityBadge severity={selected.severity} /></div>
                <h3>{selected.title}</h3>
                <div className="selected-meta"><StatusBadge status={selected.status} /><span><MapPin size={12} /> {selected.zone}</span></div>
                <p>{selected.description}</p>
                <div className="detail-grid compact-grid">
                  <div><span>Priority</span><strong>{selected.priority_score}/100</strong></div>
                  <div><span>People</span><strong>{selected.people_affected}</strong></div>
                  <div><span>Coordinates</span><strong className="mono">{Number(selected.latitude).toFixed(4)}, {Number(selected.longitude).toFixed(4)}</strong></div>
                  <div><span>Reported</span><strong>{timeAgo(selected.created_at)}</strong></div>
                </div>
                {selected.live_location && <Badge tone="teal" dot>Live GPS being shared</Badge>}
                <Button variant="primary" className="full-width" onClick={() => typeof selected.id === 'number' && setOpenIncidentId(selected.id)}>Open incident</Button>
              </div>
            )}
          </Card>

          <Card className="map-side-list-card">
            <CardHead title="Priority pins" subtitle="Highest priority first" icon={Activity} tone="red" />
            {incidents.length === 0 ? <EmptyState icon={MapPin} title="Nothing on the map" description="Adjust the filters to show more incidents." /> : (
              <div className="map-pin-list">
                {incidents.slice(0, 8).map((incident) => (
                  <button key={incident.id} className={`map-pin-row ${String(selectedId) === String(incident.id) ? 'active' : ''}`} onClick={() => setSelectedId(incident.id)}>
                    <span className="pin-dot" style={{ background: incident.category_color || '#f26430' }} />
                    <div><strong>{incident.title}</strong><small>{incident.code} · {incident.zone}</small></div>
                    <span className="pin-score">{incident.priority_score}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="map-side-list-card">
            <CardHead title="Field units" subtitle="Live team telemetry" icon={Truck} tone="blue" />
            <div className="unit-list">
              {teamList.slice(0, 5).map((team) => (
                <div className="unit-row" key={team.id}>
                  <span className={`unit-status status-${team.status}`} />
                  <div><strong>{team.code}</strong><small>{team.type}</small></div>
                  <Badge tone={team.status === 'deployed' ? 'orange' : team.status === 'available' ? 'green' : 'slate'}>{team.active_incidents}/{team.capacity}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="map-side-list-card">
            <CardHead title="Medical capacity" subtitle="Nearest receiving facilities" icon={BedDouble} tone="teal" />
            <div className="capacity-list">
              {hospitalList.slice(0, 4).map((hospital) => (
                <div className="capacity-row" key={hospital.id}>
                  <div className="capacity-row-head"><strong>{hospital.code}</strong><span>{hospital.beds_available}/{hospital.beds_total} beds</span></div>
                  <ProgressBar value={hospital.beds_available} max={hospital.beds_total || 1} tone={hospital.beds_available / (hospital.beds_total || 1) < 0.15 ? 'red' : 'teal'} height={5} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
