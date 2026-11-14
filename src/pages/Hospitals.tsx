import React from 'react';
import { Activity, BedDouble, Droplets, HeartPulse, Minus, Plus, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { HOSPITAL_STATUSES, asOptions } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { Badge, Button, Card, CardHead, EmptyState, ProgressBar, StatCard } from '../components/ui';
import { ResourceManager, type FormField, type TableColumn } from '../components/ResourceManager';

const fields: FormField[] = [
  { key: 'name', label: 'Hospital name', type: 'text', required: true, span: 2 },
  { key: 'code', label: 'Facility code', type: 'text', required: true, placeholder: 'RGGGH' },
  { key: 'zone', label: 'Zone', type: 'select', options: asOptions(ZONES) },
  { key: 'address', label: 'Address', type: 'text', span: 2 },
  { key: 'latitude', label: 'Latitude', type: 'number', step: '0.00001' },
  { key: 'longitude', label: 'Longitude', type: 'number', step: '0.00001' },
  { key: 'beds_total', label: 'Total beds', type: 'number', min: 0 },
  { key: 'beds_available', label: 'Available beds', type: 'number', min: 0 },
  { key: 'icu_total', label: 'Total ICU beds', type: 'number', min: 0 },
  { key: 'icu_available', label: 'Available ICU beds', type: 'number', min: 0 },
  { key: 'oxygen_units', label: 'Oxygen cylinders', type: 'number', min: 0 },
  { key: 'ambulances', label: 'Ambulances', type: 'number', min: 0 },
  { key: 'trauma_level', label: 'Trauma level', type: 'text', placeholder: 'Level I Trauma' },
  { key: 'status', label: 'Operating status', type: 'select', options: asOptions(HOSPITAL_STATUSES) },
  { key: 'contact', label: 'Emergency contact', type: 'text' },
  { key: 'blood_units', label: 'Blood units (JSON)', type: 'json', span: 2, hint: 'Example: {"O+": 32, "A+": 20}' },
];

const columns: TableColumn[] = [
  { key: 'name', label: 'Facility', width: '24%', render: (row) => <div className="entity-cell"><span className="entity-icon tone-teal"><HeartPulse size={15} /></span><div><strong>{row.name}</strong><span className="mono cell-sub">{row.code} · {row.zone}</span></div></div> },
  { key: 'beds_available', label: 'General beds', render: (row) => <div className="capacity-cell"><strong>{row.beds_available}/{row.beds_total}</strong><ProgressBar value={row.beds_available} max={row.beds_total || 1} tone={row.beds_available / (row.beds_total || 1) < 0.15 ? 'red' : 'teal'} height={5} /></div> },
  { key: 'icu_available', label: 'ICU', render: (row) => <div className="capacity-cell"><strong>{row.icu_available}/{row.icu_total}</strong><ProgressBar value={row.icu_available} max={row.icu_total || 1} tone={row.icu_available / (row.icu_total || 1) < 0.15 ? 'red' : 'blue'} height={5} /></div> },
  { key: 'oxygen_units', label: 'Oxygen' },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'operational' ? 'green' : row.status === 'limited' ? 'amber' : 'red'} dot>{row.status}</Badge> },
  { key: 'contact', label: 'Contact', render: (row) => <span className="mono cell-sub">{row.contact || '—'}</span> },
];

export function Hospitals() {
  const { data, loading, mutate, can, setOpenIncidentId } = useApp();
  const bedsTotal = data.hospitals.reduce((sum, hospital) => sum + hospital.beds_total, 0);
  const bedsFree = data.hospitals.reduce((sum, hospital) => sum + hospital.beds_available, 0);
  const icuFree = data.hospitals.reduce((sum, hospital) => sum + hospital.icu_available, 0);
  const oxygen = data.hospitals.reduce((sum, hospital) => sum + hospital.oxygen_units, 0);
  const inbound = data.incidents.filter((incident) => incident.assigned_hospital_id && ['assigned', 'in_progress'].includes(incident.status));

  const adjustBeds = (hospital: any, delta: number) => {
    const next = Math.max(0, Math.min(hospital.beds_total, Number(hospital.beds_available) + delta));
    mutate.update('hospitals', hospital.id, { beds_available: next });
  };

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Network beds" value={`${bedsFree}/${bedsTotal}`} icon={BedDouble} tone="teal" hint="Available right now" loading={loading.hospitals} />
        <StatCard label="ICU beds free" value={icuFree} icon={Activity} tone="violet" hint="Critical care capacity" loading={loading.hospitals} />
        <StatCard label="Oxygen cylinders" value={oxygen} icon={Droplets} tone="blue" hint="Across all facilities" loading={loading.hospitals} />
        <StatCard label="Inbound patients" value={inbound.length} icon={Truck} tone="orange" hint="Linked to active incidents" loading={loading.incidents} />
      </div>

      <div className="hospital-board">
        {loading.hospitals ? (
          <Card><div className="table-loading"><div className="skeleton" style={{ height: 120 }} /></div></Card>
        ) : data.hospitals.length === 0 ? (
          <Card><EmptyState icon={HeartPulse} title="No hospitals configured" description="Add a facility to start tracking capacity." /></Card>
        ) : data.hospitals.map((hospital) => {
          const bedPercent = Math.round((hospital.beds_available / (hospital.beds_total || 1)) * 100);
          const icuPercent = Math.round((hospital.icu_available / (hospital.icu_total || 1)) * 100);
          return (
            <Card className="hospital-capacity-card" key={hospital.id}>
              <div className="hospital-capacity-head">
                <span className="entity-icon tone-teal"><HeartPulse size={17} /></span>
                <div><strong>{hospital.name}</strong><small>{hospital.code} · {hospital.zone}</small></div>
                <Badge tone={hospital.status === 'operational' ? 'green' : hospital.status === 'limited' ? 'amber' : 'red'} dot>{hospital.status}</Badge>
              </div>
              <div className="hospital-metrics">
                <div><span>General beds</span><strong>{hospital.beds_available}<small> / {hospital.beds_total}</small></strong><ProgressBar value={bedPercent} tone={bedPercent < 15 ? 'red' : 'teal'} height={6} /></div>
                <div><span>ICU beds</span><strong>{hospital.icu_available}<small> / {hospital.icu_total}</small></strong><ProgressBar value={icuPercent} tone={icuPercent < 20 ? 'red' : 'blue'} height={6} /></div>
              </div>
              <div className="hospital-extra"><span><Droplets size={13} /> {hospital.oxygen_units} O₂</span><span><Truck size={13} /> {hospital.ambulances} ambulances</span><span>{hospital.trauma_level}</span></div>
              {can('hospital:manage') && (
                <div className="hospital-adjust">
                  <Button size="sm" variant="ghost" icon={Minus} onClick={() => adjustBeds(hospital, -1)}>Admit</Button>
                  <span>Update beds instantly</span>
                  <Button size="sm" variant="ghost" icon={Plus} onClick={() => adjustBeds(hospital, 1)}>Release</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHead title="Inbound patient flow" subtitle="Active incidents with a receiving facility assigned" icon={Truck} tone="orange" />
        {inbound.length === 0 ? <EmptyState icon={Truck} title="No inbound transfers" description="Incidents assigned to hospitals will appear here." /> : (
          <div className="inbound-list">
            {inbound.map((incident) => {
              const hospital = data.hospitals.find((item) => String(item.id) === String(incident.assigned_hospital_id));
              return (
                <button className="inbound-row" key={incident.id} onClick={() => typeof incident.id === 'number' && setOpenIncidentId(incident.id)}>
                  <span className="inbound-icon"><Activity size={15} /></span>
                  <div><strong>{incident.title}</strong><small>{incident.code} · {incident.people_affected} people affected</small></div>
                  <Badge tone="blue">{hospital?.code || 'Facility'}</Badge>
                  <span className="muted">{timeAgo(incident.created_at)}</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <ResourceManager
        resource="hospitals"
        title="Hospital directory"
        subtitle="Full CRUD for facilities, capacity and blood bank records"
        icon={HeartPulse}
        columns={columns}
        fields={fields}
        filters={[
          { key: 'status', label: 'Status', options: asOptions(HOSPITAL_STATUSES) },
          { key: 'zone', label: 'Zone', options: asOptions(ZONES) },
        ]}
        defaultValues={{ status: 'operational', beds_total: 100, beds_available: 60, icu_total: 20, icu_available: 10, oxygen_units: 100, ambulances: 3, latitude: 13.072, longitude: 80.251, blood_units: {} }}
        emptyTitle="No hospitals found"
      />
    </div>
  );
}
