import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Bot, BrainCircuit, Building2, CheckCircle2,
  Clock3, Compass, Copy, Crosshair, GitMerge, MapPin, MessageSquareText, Pencil,
  Radio, Send, ShieldAlert, Sparkles, Trash2, Truck, UserRound, Users, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { get } from '../lib/api';
import { formatDateTime, relativeDue, timeAgo } from '../lib/format';
import {
  Badge, Button, ConfirmDialog, Drawer, EmptyState, Field, KeyValue, Modal,
  PriorityMeter, ProgressBar, Select, SeverityBadge, Skeleton, StatusBadge,
  Tabs, TagList, TextArea, TextInput,
} from './ui';
import { IncidentMap } from './IncidentMap';

const STATUS_OPTIONS = [
  ['pending', 'Pending triage'], ['triaged', 'Triaged'], ['assigned', 'Assigned'],
  ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed'], ['duplicate', 'Duplicate'],
];

export function IncidentDrawer() {
  const {
    openIncidentId, setOpenIncidentId, data, loadMessages, messagesIncidentId,
    sendMessage, allocate, mergeIncident, mutate, can, user, isOffline, pushToast,
    updateIncidentLocation,
  } = useApp();
  const [tab, setTab] = useState('overview');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [liveTracking, setLiveTracking] = useState(false);
  const watchRef = React.useRef<number | null>(null);

  const incident = useMemo(
    () => data.incidents.find((item) => String(item.id) === String(openIncidentId)),
    [data.incidents, openIncidentId],
  );
  const primary = incident?.duplicate_of
    ? data.incidents.find((item) => String(item.id) === String(incident.duplicate_of))
    : null;
  const assignedTeam = incident?.assigned_team_id
    ? data.teams.find((team) => String(team.id) === String(incident.assigned_team_id))
    : null;
  const assignedHospital = incident?.assigned_hospital_id
    ? data.hospitals.find((hospital) => String(hospital.id) === String(incident.assigned_hospital_id))
    : null;
  const messages = data.messages.filter((message) => String(message.incident_id) === String(openIncidentId));

  useEffect(() => {
    if (!openIncidentId) return;
    setTab('overview');
    loadMessages(openIncidentId);
    setRecLoading(true);
    get(`/incidents/${openIncidentId}/recommendations`)
      .then((result) => setRecommendations(result.recommendations || []))
      .catch(() => setRecommendations([]))
      .finally(() => setRecLoading(false));
  }, [openIncidentId, loadMessages]);

  useEffect(() => () => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  if (!openIncidentId || !incident) return null;
  const numericId = typeof incident.id === 'number' ? incident.id : null;
  const canEdit = can('incident:update') || (incident.reporter_id === user?.id && ['pending', 'triaged'].includes(incident.status));
  const canDelete = can('incident:delete') || (incident.reporter_id === user?.id && incident.status === 'pending');
  const canAllocate = can('incident:assign');

  const openEdit = () => {
    setEditForm({
      title: incident.title, description: incident.description || '',
      address: incident.address || '', zone: incident.zone || '',
      severity: incident.severity, people_affected: incident.people_affected,
      vulnerable_count: incident.vulnerable_count, reporter_phone: incident.reporter_phone || '',
      latitude: incident.latitude, longitude: incident.longitude,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) {
      pushToast({ title: 'A title is required', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await mutate.update('incidents', incident.id, {
        title: editForm.title, description: editForm.description,
        address: editForm.address, zone: editForm.zone,
        severity: Number(editForm.severity),
        people_affected: Number(editForm.people_affected),
        vulnerable_count: Number(editForm.vulnerable_count),
        latitude: Number(editForm.latitude), longitude: Number(editForm.longitude),
        recompute_priority: true,
      });
      setEditOpen(false);
      pushToast({ title: 'Incident updated', tone: 'success' });
    } catch { /* handled in context */ }
    finally { setSaving(false); }
  };

  const send = async () => {
    if (!messageText.trim() || !numericId) return;
    const text = messageText.trim();
    setMessageText('');
    await sendMessage(numericId, text);
  };

  const startTracking = () => {
    if (!numericId || !navigator.geolocation) {
      pushToast({ title: 'Geolocation is unavailable', tone: 'warning' });
      return;
    }
    if (liveTracking) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setLiveTracking(false);
      return;
    }
    setLiveTracking(true);
    let last = 0;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - last < 5000) return;
        last = Date.now();
        updateIncidentLocation(numericId, position.coords.latitude, position.coords.longitude);
      },
      () => setLiveTracking(false),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    pushToast({ title: 'Live GPS sharing started', description: 'Responders will see position updates in real time.', tone: 'success' });
  };

  const drawerSubtitle = (
    <div className="drawer-sub-line">
      <span className="mono">{incident.code}</span>
      <StatusBadge status={incident.status} />
      <SeverityBadge severity={incident.severity} />
      {incident.pendingSync && <Badge tone="amber" dot>Queued offline</Badge>}
    </div>
  );

  return (
    <>
      <Drawer
        open
        onClose={() => setOpenIncidentId(null)}
        title={incident.title}
        subtitle={drawerSubtitle}
        width={660}
        footer={
          <div className="drawer-actions">
            <Button variant="ghost" icon={Pencil} onClick={openEdit} disabled={!canEdit}>Edit</Button>
            {canAllocate && <Button variant="outline" icon={Sparkles} onClick={() => numericId && allocate(numericId)} disabled={!numericId}>AI allocate</Button>}
            <Button variant="success" icon={CheckCircle2} onClick={() => setTab('overview')} className="hide-mobile">Track live</Button>
            <div className="grow" />
            {canDelete && <Button variant="ghost" icon={Trash2} onClick={() => setDeleteOpen(true)} className="btn-danger-text" />}
          </div>
        }
      >
        <div className="drawer-priority-strip">
          <div><span className="strip-label">Priority score</span><PriorityMeter score={incident.priority_score} /></div>
          <div><span className="strip-label">SLA</span><strong className={relativeDue(incident.created_at, incident.sla_minutes || 20).includes('overdue') ? 'text-red' : ''}>{relativeDue(incident.created_at, incident.sla_minutes || 20)}</strong></div>
          <div><span className="strip-label">Reported</span><strong>{timeAgo(incident.created_at)}</strong></div>
        </div>

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'ai', label: 'AI & allocation' },
            { id: 'communications', label: 'Channel', count: messages.length },
            { id: 'timeline', label: 'Timeline' },
          ]}
        />

        {tab === 'overview' && (
          <div className="drawer-section">
            {incident.duplicate_of && (
              <div className="duplicate-banner">
                <GitMerge size={18} />
                <div>
                  <strong>Possible duplicate report</strong>
                  <p>{Math.round((incident.duplicate_score || 0) * 100)}% match with {primary?.code || `incident #${incident.duplicate_of}`}{primary ? ` — ${primary.title}` : ''}.</p>
                </div>
                {canAllocate && incident.status !== 'duplicate' && numericId && (
                  <Button size="sm" variant="outline" onClick={() => mergeIncident(numericId, Number(incident.duplicate_of))}>Merge</Button>
                )}
              </div>
            )}
            {incident.pendingSync && (
              <div className="offline-banner compact"><WifiOff size={17} /><div><strong>Queued on this device</strong><p>This report will be uploaded and classified automatically when the connection returns.</p></div></div>
            )}

            <div className="drawer-description">{incident.description || 'No additional details were provided.'}</div>

            <div className="mini-map-wrap">
              <IncidentMap incidents={[incident]} teams={[]} hospitals={[]} showTeams={false} showHospitals={false} height={210} selectedId={incident.id} />
              <div className="mini-map-overlay">
                <span><MapPin size={13} /> {incident.address || 'GPS position'}</span>
                <span className="mono">{Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)}</span>
              </div>
            </div>

            <div className="detail-grid">
              <KeyValue label="Reported by" value={incident.reporter_name || 'Unknown'} />
              <KeyValue label="Contact" value={incident.reporter_phone || '—'} mono />
              <KeyValue label="Zone" value={incident.zone} />
              <KeyValue label="Source" value={incident.source?.toUpperCase()} />
              <KeyValue label="Category" value={incident.category_label} />
              <KeyValue label="AI confidence" value={incident.ai_confidence ? `${Math.round(incident.ai_confidence * 100)}%` : '—'} />
              <KeyValue label="People affected" value={incident.people_affected} />
              <KeyValue label="Vulnerable people" value={incident.vulnerable_count} />
              <KeyValue label="Created" value={formatDateTime(incident.created_at)} />
              <KeyValue label="Last update" value={timeAgo(incident.updated_at)} />
              <KeyValue label="Assigned team" value={assignedTeam ? `${assignedTeam.code} · ${assignedTeam.type}` : 'Not assigned'} />
              <KeyValue label="Receiving hospital" value={assignedHospital?.code || 'Not assigned'} />
            </div>

            <div className="drawer-inline-actions">
              <Button size="sm" variant={liveTracking ? 'success' : 'outline'} icon={Radio} onClick={startTracking}>
                {liveTracking ? 'Stop live GPS' : 'Share live location'}
              </Button>
              <Button size="sm" variant="ghost" icon={Copy} onClick={() => { navigator.clipboard?.writeText(`${incident.code}: ${incident.title} @ ${incident.latitude}, ${incident.longitude}`); pushToast({ title: 'Incident details copied', tone: 'success' }); }}>
                Copy details
              </Button>
            </div>

            <div className="status-control">
              <span className="field-label">Update status</span>
              <div className="row gap-8 wrap">
                <Select value={incident.status} onChange={(event) => numericId && mutate.update('incidents', incident.id, { status: event.target.value })} disabled={!canEdit} className="status-select">
                  {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                {['pending', 'triaged', 'assigned'].includes(incident.status) && (
                  <Button size="sm" variant="success" icon={CheckCircle2} disabled={!canEdit} onClick={() => mutate.update('incidents', incident.id, { status: 'resolved' })}>Mark resolved</Button>
                )}
              </div>
            </div>

            {incident.tags?.length ? <div className="drawer-tags"><span className="field-label">AI tags</span><TagList tags={incident.tags} tone="blue" /></div> : null}
          </div>
        )}

        {tab === 'ai' && (
          <div className="drawer-section">
            <div className="ai-summary-card">
              <div className="ai-summary-head"><BrainCircuit size={18} /><div><strong>Explainable classification</strong><small>Rule-based incident intelligence · on-device</small></div><Badge tone="teal">{incident.ai_confidence ? `${Math.round(incident.ai_confidence * 100)}% confidence` : 'Pending'}</Badge></div>
              <div className="ai-summary-row">
                <div><span>Category</span><strong>{incident.category_label || incident.category}</strong></div>
                <div><span>Severity</span><SeverityBadge severity={incident.severity} /></div>
                <div><span>Urgency</span><Badge tone={incident.urgency === 'CRITICAL' ? 'red' : incident.urgency === 'HIGH' ? 'orange' : 'amber'}>{incident.urgency || 'MODERATE'}</Badge></div>
                <div><span>Priority</span><strong>{incident.priority_score}/100</strong></div>
              </div>
              <div className="ai-reasoning-list">
                {(incident.reasoning || []).map((reason) => <div key={reason}><CheckCircle2 size={13} /> {reason}</div>)}
                {!incident.reasoning?.length && <div className="muted">Classification reasoning is generated when the report is synced.</div>}
              </div>
              <div className="ai-factors">
                <span>Priority factors</span>
                <div className="factor-chips">
                  <Badge tone="red">Severity ×13</Badge><Badge tone="orange">People affected</Badge>
                  <Badge tone="amber">Vulnerable people</Badge><Badge tone="blue">Report age</Badge>
                  <Badge tone="violet">Source trust</Badge>
                </div>
              </div>
            </div>

            <div className="section-divider"><span>Intelligent team allocation</span></div>
            {recLoading ? (
              <div className="rec-loading"><Skeleton height={54} /><Skeleton height={54} /><Skeleton height={54} /></div>
            ) : recommendations.length === 0 ? (
              <EmptyState icon={Truck} title="No teams available" description="Team recommendations appear when units are online." />
            ) : (
              <div className="recommendation-list">
                {recommendations.slice(0, 6).map((team, index) => (
                  <div className={`recommendation ${index === 0 ? 'top' : ''}`} key={team.id}>
                    <div className="rec-rank">#{index + 1}</div>
                    <div className="rec-body">
                      <div className="rec-head">
                        <strong>{team.code} · {team.name}</strong>
                        <Badge tone={team.score >= 60 ? 'teal' : 'blue'}>Score {team.score}</Badge>
                      </div>
                      <div className="rec-meta">
                        <span><Compass size={12} /> {team.distanceKm} km</span>
                        <span><Clock3 size={12} /> ETA {team.etaMinutes} min</span>
                        <span><Activity size={12} /> {team.status}</span>
                      </div>
                      <div className="rec-reasons">{team.reasons.join(' · ')}</div>
                    </div>
                    {canAllocate && numericId && (
                      <Button size="sm" variant={index === 0 ? 'primary' : 'ghost'} onClick={() => allocate(numericId, team.id)}>Assign</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'communications' && (
          <div className="drawer-section chat-section">
            <div className="chat-info">
              <MessageSquareText size={15} />
              <span>Secure incident channel · {messages.length} messages</span>
              {isOffline && <Badge tone="amber" dot>Offline queue</Badge>}
            </div>
            <div className="chat-thread">
              {messagesIncidentId !== openIncidentId && messages.length === 0 ? (
                <div className="chat-loading"><Skeleton height={44} /><Skeleton height={44} /></div>
              ) : messages.length === 0 ? (
                <EmptyState icon={MessageSquareText} title="No messages yet" description="Coordinate with command and field teams here." />
              ) : messages.map((message) => {
                const mine = message.author_name === user?.name;
                const system = message.kind === 'system';
                return (
                  <div className={`chat-message ${mine ? 'mine' : ''} ${system ? 'system' : ''}`} key={message.id}>
                    {!system && <div className="chat-avatar">{message.author_name?.slice(0, 1).toUpperCase()}</div>}
                    <div className="chat-bubble-wrap">
                      {system ? (
                        <div className="system-message"><Bot size={13} /> {message.body}</div>
                      ) : (
                        <>
                          <div className="chat-meta"><strong>{message.author_name}</strong><span>{message.author_role?.replace('_', ' ')}</span><span>{timeAgo(message.created_at)}</span></div>
                          <div className="chat-bubble">{message.body}{message.pendingSync && <span className="pending-label"> · queued offline</span>}</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chat-input-row">
              <TextInput
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') send(); }}
                placeholder={numericId ? 'Write an update to the incident channel…' : 'Available after offline sync'}
                disabled={!numericId}
              />
              <Button variant="primary" icon={Send} onClick={send} disabled={!messageText.trim() || !numericId}>Send</Button>
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="drawer-section">
            <div className="timeline">
              <div className="timeline-item">
                <span className="timeline-dot tone-blue" />
                <div><strong>Report received</strong><p>{incident.source?.toUpperCase()} · {incident.reporter_name || 'Reporter'} · {formatDateTime(incident.created_at)}</p></div>
              </div>
              {(incident.notes || []).slice().reverse().map((note, index) => (
                <div className="timeline-item" key={`${note.at}-${index}`}>
                  <span className="timeline-dot tone-violet" />
                  <div><strong>{note.text}</strong><p>{note.author} · {formatDateTime(note.at)}</p></div>
                </div>
              ))}
              {messages.filter((message) => message.kind === 'system').map((message) => (
                <div className="timeline-item" key={`msg-${message.id}`}>
                  <span className="timeline-dot tone-teal" />
                  <div><strong>{message.body}</strong><p>OFFGRID automation · {formatDateTime(message.created_at)}</p></div>
                </div>
              ))}
              {incident.acknowledged_at && (
                <div className="timeline-item">
                  <span className="timeline-dot tone-orange" />
                  <div><strong>Incident acknowledged</strong><p>Command centre accepted the report · {formatDateTime(incident.acknowledged_at)}</p></div>
                </div>
              )}
              {incident.resolved_at && (
                <div className="timeline-item">
                  <span className="timeline-dot tone-green" />
                  <div><strong>Incident resolved</strong><p>Closed after field confirmation · {formatDateTime(incident.resolved_at)}</p></div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit incident"
        subtitle={`${incident.code} · changes are saved with optimistic updates`}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveEdit}>Save changes</Button></>}
      >
        <div className="form-grid">
          <Field label="Title" required className="span-2"><TextInput value={editForm.title || ''} onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))} /></Field>
          <Field label="Description" className="span-2"><TextArea rows={3} value={editForm.description || ''} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
          <Field label="Address"><TextInput value={editForm.address || ''} onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))} /></Field>
          <Field label="Severity (1–5)"><TextInput type="number" min={1} max={5} value={editForm.severity ?? 3} onChange={(event) => setEditForm((prev) => ({ ...prev, severity: Number(event.target.value) }))} /></Field>
          <Field label="People affected"><TextInput type="number" min={0} value={editForm.people_affected ?? 0} onChange={(event) => setEditForm((prev) => ({ ...prev, people_affected: Number(event.target.value) }))} /></Field>
          <Field label="Vulnerable people"><TextInput type="number" min={0} value={editForm.vulnerable_count ?? 0} onChange={(event) => setEditForm((prev) => ({ ...prev, vulnerable_count: Number(event.target.value) }))} /></Field>
          <Field label="Latitude"><TextInput type="number" step="0.00001" value={editForm.latitude ?? 0} onChange={(event) => setEditForm((prev) => ({ ...prev, latitude: Number(event.target.value) }))} /></Field>
          <Field label="Longitude"><TextInput type="number" step="0.00001" value={editForm.longitude ?? 0} onChange={(event) => setEditForm((prev) => ({ ...prev, longitude: Number(event.target.value) }))} /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this incident?"
        description="The incident, its channel messages and timeline will be permanently removed. This cannot be undone."
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await mutate.remove('incidents', incident.id);
            setDeleteOpen(false);
            setOpenIncidentId(null);
          } catch { /* handled */ }
          finally { setDeleting(false); }
        }}
      />
    </>
  );
}
