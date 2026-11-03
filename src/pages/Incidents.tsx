import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Download, Edit3, Filter, GitMerge, MapPin, Plus, Search, Siren,
  SlidersHorizontal, Trash2, Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CATEGORY_OPTIONS } from '../lib/constants';
import { compactNumber, formatNumber, relativeDue, timeAgo } from '../lib/format';
import { ZONES } from '../lib/geo';
import {
  Badge, Button, ConfirmDialog, EmptyState, Field, FilterChips, IconButton, Modal,
  PriorityMeter, SearchInput, Select, SeverityBadge, SkeletonRows, StatusBadge,
  TextArea, TextInput,
} from '../components/ui';

const STATUS_TABS = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'pending', label: 'Pending' },
  { id: 'triaged', label: 'Triaged' }, { id: 'assigned', label: 'Assigned' },
  { id: 'in_progress', label: 'In progress' }, { id: 'resolved', label: 'Resolved' },
  { id: 'duplicates', label: 'Duplicates' },
];

export function Incidents() {
  const { data, loading, globalSearch, setGlobalSearch, setSosOpen, setOpenIncidentId, mutate, can, user } = useApp();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [zone, setZone] = useState('all');
  const [sort, setSort] = useState('priority');
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicates = data.incidents.filter((incident) => incident.duplicate_of && incident.status !== 'duplicate');

  const filtered = useMemo(() => {
    let rows = [...data.incidents];
    const term = globalSearch.trim().toLowerCase();
    if (term) rows = rows.filter((row) => `${row.code} ${row.title} ${row.description} ${row.address} ${row.zone}`.toLowerCase().includes(term));
    if (status === 'active') rows = rows.filter((row) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(row.status));
    else if (status === 'duplicates') rows = rows.filter((row) => row.duplicate_of || row.status === 'duplicate');
    else if (status !== 'all') rows = rows.filter((row) => row.status === status);
    if (category !== 'all') rows = rows.filter((row) => row.category === category);
    if (severity !== 'all') rows = rows.filter((row) => String(row.severity) === severity);
    if (zone !== 'all') rows = rows.filter((row) => row.zone === zone);
    if (sort === 'priority') rows.sort((a, b) => b.priority_score - a.priority_score);
    else if (sort === 'recent') rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else rows.sort((a, b) => b.severity - a.severity);
    return rows;
  }, [data.incidents, globalSearch, status, category, severity, zone, sort]);

  const openEdit = (incident: any) => {
    setEditForm({
      title: incident.title, description: incident.description || '', address: incident.address || '',
      zone: incident.zone || '', severity: incident.severity, people_affected: incident.people_affected,
      vulnerable_count: incident.vulnerable_count, status: incident.status,
    });
    setError(null);
    setEditing(incident);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) { setError('A title is required.'); return; }
    setSaving(true);
    try {
      await mutate.update('incidents', editing.id, {
        title: editForm.title, description: editForm.description, address: editForm.address,
        zone: editForm.zone, severity: Number(editForm.severity),
        people_affected: Number(editForm.people_affected), vulnerable_count: Number(editForm.vulnerable_count),
        status: editForm.status, recompute_priority: true,
      });
      setEditing(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await mutate.remove('incidents', deleteTarget.id); setDeleteTarget(null); }
    catch { /* handled */ }
    finally { setDeleting(false); }
  };

  return (
    <div className="page-stack">
      {duplicates.length > 0 && (
        <div className="review-banner">
          <span className="review-icon"><GitMerge size={18} /></span>
          <div><strong>{duplicates.length} possible duplicate report{duplicates.length === 1 ? '' : 's'} detected</strong><p>AI matched text, location and timestamps. Review and merge to keep the incident queue clean.</p></div>
          <Button size="sm" variant="outline" onClick={() => setStatus('duplicates')}>Review duplicates</Button>
        </div>
      )}

      <div className="card incidents-toolbar">
        <div className="incidents-toolbar-head">
          <FilterChips options={STATUS_TABS} value={status} onChange={setStatus} />
          <div className="row gap-8">
            <Button variant="ghost" size="sm" icon={Download} onClick={() => window.open('/api/export/incidents.csv', '_blank')}>Export</Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setSosOpen(true)}>New report</Button>
          </div>
        </div>
        <div className="incidents-filters">
          <SearchInput value={globalSearch} onChange={setGlobalSearch} placeholder="Search code, title, address or zone…" className="incidents-search" />
          <div className="filter-select"><SlidersHorizontal size={14} /><Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>
          <div className="filter-select"><Select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option>{[5, 4, 3, 2, 1].map((level) => <option key={level} value={level}>S{level}</option>)}</Select></div>
          <div className="filter-select"><Select value={zone} onChange={(event) => setZone(event.target.value)}><option value="all">All zones</option>{ZONES.map((item) => <option key={item}>{item}</option>)}</Select></div>
          <div className="filter-select"><Select value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Priority</option><option value="recent">Most recent</option><option value="severity">Severity</option></Select></div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-card-head">
          <div><h3>Incident register</h3><p>{filtered.length} of {data.incidents.length} reports · click a row for full details, AI analysis and the live channel</p></div>
          <div className="row gap-8"><Badge tone="orange">{data.incidents.filter((item) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(item.status)).length} active</Badge><Badge tone="green">{data.incidents.filter((item) => ['resolved', 'closed'].includes(item.status)).length} resolved</Badge></div>
        </div>
        {loading.incidents ? <div className="table-loading"><SkeletonRows rows={8} cols={6} /></div> : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No incidents match these filters"
            description="Clear the filters or submit a new emergency report."
            action={<div className="row gap-8"><Button variant="ghost" onClick={() => { setStatus('all'); setCategory('all'); setSeverity('all'); setZone('all'); setGlobalSearch(''); }}>Clear filters</Button><Button variant="primary" icon={Plus} onClick={() => setSosOpen(true)}>New report</Button></div>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table incidents-table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Code</th>
                  <th>Incident</th>
                  <th style={{ width: 80 }}>Severity</th>
                  <th style={{ width: 150 }}>Priority</th>
                  <th style={{ width: 130 }}>Zone</th>
                  <th style={{ width: 140 }}>Assigned team</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 110 }}>Reported</th>
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((incident) => {
                  const team = data.teams.find((item) => String(item.id) === String(incident.assigned_team_id));
                  const editable = can('incident:update') || (incident.reporter_id === user?.id && ['pending', 'triaged'].includes(incident.status));
                  const deletable = can('incident:delete') || (incident.reporter_id === user?.id && incident.status === 'pending');
                  return (
                    <tr key={incident.id} className={`${incident._optimistic ? 'is-optimistic' : ''} ${incident.pendingSync ? 'pending-sync-row' : ''} clickable-row`} onClick={() => typeof incident.id === 'number' && setOpenIncidentId(incident.id)}>
                      <td><span className="mono code-cell">{incident.code}</span>{incident.pendingSync && <div className="cell-sub">Queued offline</div>}</td>
                      <td>
                        <div className="incident-title-cell">
                          <span className="incident-color" style={{ background: incident.category_color || '#7b8798' }} />
                          <div><strong>{incident.title}</strong><div className="cell-sub">{incident.category_label || incident.category}{incident.duplicate_of ? ' · possible duplicate' : ''}</div></div>
                        </div>
                      </td>
                      <td><SeverityBadge severity={incident.severity} /></td>
                      <td><PriorityMeter score={incident.priority_score} /></td>
                      <td><span className="zone-cell"><MapPin size={12} /> {incident.zone}</span></td>
                      <td>{team ? <span className="team-cell"><Users size={12} /> {team.code}</span> : <span className="muted">Unassigned</span>}</td>
                      <td><StatusBadge status={incident.status} /><div className="cell-sub">{relativeDue(incident.created_at, incident.sla_minutes || 20)}</div></td>
                      <td><span>{timeAgo(incident.created_at)}</span><div className="cell-sub">{incident.source?.toUpperCase()}</div></td>
                      <td className="actions-col" onClick={(event) => event.stopPropagation()}>
                        <div className="row-actions">
                          <IconButton icon={Edit3} label="Edit" disabled={!editable} onClick={() => openEdit(incident)} />
                          <IconButton icon={Trash2} label="Delete" disabled={!deletable} onClick={() => setDeleteTarget(incident)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit incident report"
        subtitle={editing ? `${editing.code} · optimistic save` : undefined}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveEdit}>Save changes</Button></>}
      >
        <div className="form-grid">
          <Field label="Title" required className="span-2"><TextInput value={editForm.title || ''} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} /></Field>
          <Field label="Description" className="span-2"><TextArea rows={3} value={editForm.description || ''} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></Field>
          <Field label="Address"><TextInput value={editForm.address || ''} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} /></Field>
          <Field label="Zone"><Select value={editForm.zone || ''} onChange={(event) => setEditForm({ ...editForm, zone: event.target.value })}>{ZONES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
          <Field label="Severity"><Select value={editForm.severity || 3} onChange={(event) => setEditForm({ ...editForm, severity: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>S{level}</option>)}</Select></Field>
          <Field label="Status"><Select value={editForm.status || 'pending'} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>{['pending', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</Select></Field>
          <Field label="People affected"><TextInput type="number" value={editForm.people_affected ?? 0} onChange={(event) => setEditForm({ ...editForm, people_affected: Number(event.target.value) })} /></Field>
          <Field label="Vulnerable people"><TextInput type="number" value={editForm.vulnerable_count ?? 0} onChange={(event) => setEditForm({ ...editForm, vulnerable_count: Number(event.target.value) })} /></Field>
        </div>
        {error && <div className="form-error">{error}</div>}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete incident report?"
        description={`This permanently removes ${deleteTarget?.code} and its coordination channel.`}
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
