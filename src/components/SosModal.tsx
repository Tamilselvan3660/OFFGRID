import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, BrainCircuit, CarFront, CheckCircle2, CircleHelp, Crosshair,
  Flame, HeartPulse, LocateFixed, MapPin, Radio, Send, ShieldAlert, Siren,
  Users, WifiOff, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES, ZONE_CENTERS, requestPosition } from '../lib/geo';
import {
  Badge, Button, Field, Modal, ProgressBar, Select, SeverityBadge, Spinner, TextArea, TextInput, Toggle,
} from './ui';

const QUICK_TYPES = [
  { id: 'flood', label: 'Flood / water', icon: Crosshair, title: 'Flood emergency — people need rescue', description: 'Floodwater is rising and people need evacuation or boat rescue.' },
  { id: 'medical', label: 'Medical', icon: HeartPulse, title: 'Medical emergency — urgent assistance', description: 'A person needs urgent medical attention and an ambulance.' },
  { id: 'fire', label: 'Fire', icon: Flame, title: 'Fire emergency — smoke and flames reported', description: 'Fire and smoke reported at the location, evacuation may be needed.' },
  { id: 'accident', label: 'Accident', icon: CarFront, title: 'Road accident — injured people', description: 'Vehicle collision with injured people, traffic is blocked.' },
  { id: 'structural', label: 'Collapse', icon: ShieldAlert, title: 'Structure collapse — people trapped', description: 'A structure has collapsed and people may be trapped under debris.' },
  { id: 'other', label: 'Other', icon: CircleHelp, title: 'Emergency assistance required', description: 'Emergency assistance is required at this location.' },
];

interface FormState {
  title: string;
  description: string;
  address: string;
  zone: string;
  people_affected: number;
  vulnerable_count: number;
  reporter_phone: string;
}

const EMPTY_FORM: FormState = {
  title: '', description: '', address: '', zone: 'Central Chennai',
  people_affected: 1, vulnerable_count: 0, reporter_phone: '',
};

export function SosModal() {
  const {
    sosOpen, setSosOpen, isOffline, queue, user, createIncident, previewAI,
    setOpenIncidentId, updateIncidentLocation,
  } = useApp();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [quickType, setQuickType] = useState<string | null>(null);
  const [latitude, setLatitude] = useState(13.072);
  const [longitude, setLongitude] = useState(80.251);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [liveLocation, setLiveLocation] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const watchRef = useRef<number | null>(null);

  const locate = useCallback(async (zone = user?.zone || 'Central Chennai') => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await requestPosition();
      // Real GPS is always stored; the stylised map clamps distant pins to the
      // visible Chennai operating area.
      setLatitude(position.latitude);
      setLongitude(position.longitude);
      setAccuracy(position.accuracy ?? null);
    } catch {
      const center = ZONE_CENTERS[zone] || ZONE_CENTERS['Central Chennai'];
      setLatitude(center.lat);
      setLongitude(center.lng);
      setLocationError('Live GPS unavailable — using your registered zone centre. You can edit the position later.');
    } finally {
      setLocating(false);
    }
  }, [user?.zone]);

  useEffect(() => {
    if (!sosOpen) return;
    setForm({ ...EMPTY_FORM, zone: user?.zone || 'Central Chennai', reporter_phone: user?.phone || '' });
    setQuickType(null);
    setError(null);
    setPreview(null);
    setLiveLocation(true);
    locate();
  }, [sosOpen, user?.zone, user?.phone, locate]);

  useEffect(() => {
    if (!sosOpen) return;
    window.clearTimeout(debounceRef.current);
    if (!form.title.trim() && !form.description.trim()) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const result = await previewAI({
        title: form.title, description: form.description, zone: form.zone,
        latitude, longitude, people_affected: form.people_affected,
        vulnerable_count: form.vulnerable_count, source: 'sos',
      });
      setPreview(result);
      setPreviewLoading(false);
    }, 550);
    return () => window.clearTimeout(debounceRef.current);
  }, [sosOpen, form.title, form.description, form.zone, form.people_affected, form.vulnerable_count, latitude, longitude, previewAI, isOffline]);

  useEffect(() => () => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const startLiveTracking = (incidentId: number) => {
    if (!navigator.geolocation || watchRef.current !== null) return;
    let lastSent = 0;
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastSent < 6000) return;
        lastSent = Date.now();
        updateIncidentLocation(incidentId, position.coords.latitude, position.coords.longitude);
      },
      () => { /* location sharing is best effort */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const update = (key: keyof FormState, value: string | number) => setForm((prev) => ({ ...prev, [key]: value }));

  const doSubmit = async (override?: Partial<FormState> & { instant?: boolean }) => {
    const payloadForm = { ...form, ...override };
    if (!payloadForm.title.trim()) {
      setError('Add a short title describing the emergency.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const incident = await createIncident({
        title: payloadForm.title,
        description: payloadForm.description,
        address: payloadForm.address || 'Location shared via GPS',
        zone: payloadForm.zone,
        latitude,
        longitude,
        people_affected: Number(payloadForm.people_affected) || 0,
        vulnerable_count: Number(payloadForm.vulnerable_count) || 0,
        reporter_phone: payloadForm.reporter_phone,
        live_location: liveLocation,
        source: override?.instant ? 'sos' : 'web',
      });
      setSosOpen(false);
      if (incident && typeof incident.id === 'number') {
        setOpenIncidentId(incident.id);
        if (liveLocation) startLiveTracking(incident.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const classification = preview?.classification;
  const duplicate = preview?.duplicate;
  const recommendations = preview?.recommendations || [];

  return (
    <Modal
      open={sosOpen}
      onClose={() => setSosOpen(false)}
      title="Report an emergency"
      subtitle="Smart SOS · GPS location · AI triage · works offline"
      size="lg"
      footer={
        <>
          <div className="sos-footer-note">
            {isOffline
              ? <><WifiOff size={14} /> Offline — saved on this device</>
              : <><CheckCircle2 size={14} /> Connected — instant dispatch</>}
          </div>
          <div className="row gap-8">
            <Button variant="ghost" onClick={() => setSosOpen(false)}>Cancel</Button>
            <Button variant="primary" icon={Send} loading={sending} onClick={() => doSubmit()}>Submit report</Button>
          </div>
        </>
      }
    >
      <div className="sos-grid">
        <div className="sos-main">
          <button
            className="instant-sos"
            onClick={() => doSubmit({
              instant: true,
              title: 'SOS — emergency assistance needed at my location',
              description: 'Automatic SOS beacon triggered from the OFFGRID app. Live GPS position is being shared with the response network.',
            })}
            disabled={sending}
          >
            <span className="instant-sos-icon"><Siren size={24} /></span>
            <span className="instant-sos-text">
              <strong>One-tap SOS</strong>
              <small>Send my live location to command now</small>
            </span>
            <Zap size={18} />
          </button>

          <div className="quick-types-label">What is happening?</div>
          <div className="quick-types">
            {QUICK_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  className={`quick-type ${quickType === type.id ? 'active' : ''}`}
                  onClick={() => {
                    setQuickType(type.id);
                    setForm((prev) => ({ ...prev, title: type.title, description: type.description }));
                  }}
                >
                  <Icon size={15} /> {type.label}
                </button>
              );
            })}
          </div>

          <div className="form-grid">
            <Field label="Emergency title" required className="span-2">
              <TextInput value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Floodwater entering homes, 6 people stranded" />
            </Field>
            <Field label="What do responders need to know?" className="span-2" hint="The AI engine classifies severity, category and priority from this description.">
              <TextArea rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe hazards, people affected, access routes and any immediate risks…" />
            </Field>
            <Field label="People affected">
              <TextInput type="number" min={0} value={form.people_affected} onChange={(event) => update('people_affected', Number(event.target.value))} />
            </Field>
            <Field label="Children / elderly / immobile">
              <TextInput type="number" min={0} value={form.vulnerable_count} onChange={(event) => update('vulnerable_count', Number(event.target.value))} />
            </Field>
            <Field label="Address or landmark" className="span-2">
              <TextInput value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Street, landmark or nearest junction" />
            </Field>
            <Field label="Zone">
              <Select value={form.zone} onChange={(event) => update('zone', event.target.value)}>
                {ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </Select>
            </Field>
            <Field label="Callback number">
              <TextInput value={form.reporter_phone} onChange={(event) => update('reporter_phone', event.target.value)} placeholder="+91 …" />
            </Field>
          </div>
          {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}
        </div>

        <aside className="sos-aside">
          <div className="gps-card">
            <div className="gps-head">
              <span className="gps-icon"><LocateFixed size={17} /></span>
              <div><strong>GPS location</strong><small>{locating ? 'Acquiring position…' : accuracy ? `Accuracy ±${Math.round(accuracy)} m` : 'Zone centre fallback'}</small></div>
              <button onClick={() => locate(form.zone)} disabled={locating}>{locating ? <Spinner size={14} /> : <Radio size={14} />}</button>
            </div>
            <div className="gps-coords mono">{latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E</div>
            <div className="gps-mini-map">
              <div className="gps-grid" />
              <div className="gps-pin"><MapPin size={18} /></div>
              <span className="gps-ring" />
            </div>
            {locationError && <p className="gps-warning">{locationError}</p>}
            <Toggle checked={liveLocation} onChange={setLiveLocation} label="Share live location" description="Stream GPS pings to responders" />
          </div>

          {isOffline && (
            <div className="offline-banner">
              <WifiOff size={17} />
              <div><strong>Offline mode active</strong><p>This report will be stored on the device and synced automatically. {queue.length} item{queue.length === 1 ? '' : 's'} already queued.</p></div>
            </div>
          )}

          <div className="ai-preview">
            <div className="ai-preview-head"><BrainCircuit size={16} /><strong>AI assessment</strong>{previewLoading && <Spinner size={13} />}</div>
            {isOffline ? (
              <div className="ai-preview-empty">Classification runs when the connection returns. Your report is still safe.</div>
            ) : !preview && !previewLoading ? (
              <div className="ai-preview-empty">Start describing the emergency to see live classification, priority and duplicate detection.</div>
            ) : previewLoading && !classification ? (
              <div className="ai-preview-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
            ) : classification ? (
              <>
                <div className="ai-class-row">
                  <div><span className="ai-label">Category</span><strong>{classification.categoryLabel}</strong></div>
                  <SeverityBadge severity={classification.severity} />
                </div>
                <div className="ai-confidence">
                  <span>Confidence</span><strong>{Math.round(classification.confidence * 100)}%</strong>
                  <ProgressBar value={classification.confidence * 100} tone={classification.confidence > 0.8 ? 'teal' : 'amber'} height={5} />
                </div>
                <div className="ai-priority">
                  <span>Estimated priority</span><strong>{preview?.priorityPreview ?? '—'}/100</strong>
                  <ProgressBar value={preview?.priorityPreview ?? 0} tone={(preview?.priorityPreview ?? 0) >= 70 ? 'red' : 'orange'} height={5} />
                </div>
                <div className="ai-reasons">
                  {classification.reasoning.slice(0, 3).map((reason: string) => <div key={reason}><CheckCircle2 size={12} /> {reason}</div>)}
                </div>
                {duplicate && (
                  <div className="ai-duplicate"><AlertTriangle size={14} /><span>Possible duplicate of <strong>{duplicate.code}</strong> ({Math.round(duplicate.score * 100)}%)</span></div>
                )}
                {recommendations.length > 0 && (
                  <div className="ai-recs">
                    <span className="ai-label">Recommended teams</span>
                    {recommendations.map((team: any) => (
                      <div className="ai-rec" key={team.id}>
                        <span>{team.code} · {team.type}</span>
                        <Badge tone="blue">{team.etaMinutes} min</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
