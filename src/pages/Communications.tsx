import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot, CheckCircle2, Clock3, Hash, MessageSquareText, Radio, Search, Send,
  ShieldAlert, Siren, Users, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatTime, timeAgo } from '../lib/format';
import {
  Avatar, Badge, Button, Card, CardHead, EmptyState, PriorityMeter, SearchInput,
  SeverityBadge, Skeleton, StatusBadge, TextInput,
} from '../components/ui';

const QUICK_UPDATES = ['Team is on scene', 'Requesting additional backup', 'Patients stabilised', 'Area secured, standing by'];

export function Communications() {
  const {
    data, loading, loadMessages, messagesIncidentId, sendMessage, user, isOffline,
    sseConnected, setOpenIncidentId,
  } = useApp();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');

  const channels = useMemo(
    () => data.incidents
      .filter((incident) => typeof incident.id === 'number')
      .filter((incident) => `${incident.code} ${incident.title} ${incident.zone}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aActive = ['pending', 'triaged', 'assigned', 'in_progress'].includes(a.status) ? 0 : 1;
        const bActive = ['pending', 'triaged', 'assigned', 'in_progress'].includes(b.status) ? 0 : 1;
        return aActive - bActive || b.priority_score - a.priority_score;
      }),
    [data.incidents, search],
  );

  useEffect(() => {
    if (!selectedId && channels.length) setSelectedId(channels[0].id as number);
  }, [channels, selectedId]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const selected = data.incidents.find((incident) => incident.id === selectedId);
  const messages = data.messages.filter((message) => message.incident_id === selectedId);
  const isLoadingMessages = messagesIncidentId !== selectedId && messages.length === 0;

  const send = async (body = text) => {
    if (!body.trim() || !selectedId) return;
    setText('');
    await sendMessage(selectedId, body.trim());
  };

  return (
    <div className="page-stack">
      <Card className="comms-status-card">
        <div className="comms-status-left">
          <span className="comms-status-icon"><Radio size={19} /></span>
          <div><strong>Incident coordination channels</strong><p>Secure, real-time messaging between command, field units and medical teams.</p></div>
        </div>
        <div className="comms-status-right">
          <Badge tone={sseConnected && !isOffline ? 'green' : 'amber'} dot>{sseConnected && !isOffline ? 'Live stream connected' : isOffline ? 'Offline queue active' : 'Reconnecting'}</Badge>
          <span>{channels.length} channels</span>
        </div>
      </Card>

      <div className="comms-layout">
        <Card className="channel-list-card">
          <div className="channel-list-head"><h3>Channels</h3><Badge tone="blue">{channels.length}</Badge></div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search channels…" />
          {loading.incidents ? (
            <div className="channel-loading"><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>
          ) : channels.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="No channels found" description="Incident channels are created automatically when reports arrive." />
          ) : (
            <div className="channel-list">
              {channels.map((incident) => {
                const count = data.messages.filter((message) => message.incident_id === incident.id).length;
                return (
                  <button key={incident.id} className={`channel-row ${selectedId === incident.id ? 'active' : ''}`} onClick={() => setSelectedId(incident.id as number)}>
                    <div className="channel-row-top"><span className="mono">{incident.code}</span><SeverityBadge severity={incident.severity} /></div>
                    <strong>{incident.title}</strong>
                    <div className="channel-row-meta"><span><Clock3 size={11} /> {timeAgo(incident.updated_at)}</span>{count > 0 && <span className="channel-count"><MessageSquareText size={11} /> {count}</span>}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="chat-card">
          {!selected ? (
            <EmptyState icon={Hash} title="Select a channel" description="Choose an incident channel to view its conversation." />
          ) : (
            <>
              <div className="chat-card-head">
                <div className="chat-card-title">
                  <span className={`chat-channel-icon tone-${selected.severity >= 4 ? 'red' : 'blue'}`}><Siren size={18} /></span>
                  <div><h3>{selected.title}</h3><div className="row gap-8"><span className="mono cell-sub">{selected.code}</span><StatusBadge status={selected.status} /></div></div>
                </div>
                <div className="chat-card-actions"><PriorityMeter score={selected.priority_score} /><Button size="sm" variant="ghost" onClick={() => setOpenIncidentId(selected.id as number)}>Incident details</Button></div>
              </div>

              <div className="chat-card-meta">
                <span><Users size={13} /> {selected.reporter_name || 'Reporter'} · {selected.zone}</span>
                <span><ShieldAlert size={13} /> {selected.people_affected} affected</span>
                <span><Radio size={13} /> {sseConnected ? 'Live' : 'Reconnecting'}</span>
                {isOffline && <Badge tone="amber" dot><WifiOff size={11} /> Offline</Badge>}
              </div>

              <div className="chat-thread large">
                {isLoadingMessages ? (
                  <div className="chat-loading"><Skeleton height={52} /><Skeleton height={52} /><Skeleton height={52} /></div>
                ) : messages.length === 0 ? (
                  <EmptyState icon={MessageSquareText} title="Start the conversation" description="Send a field update to everyone coordinating this incident." />
                ) : messages.map((message) => {
                  const mine = message.author_name === user?.name;
                  const system = message.kind === 'system';
                  return (
                    <div className={`chat-message ${mine ? 'mine' : ''} ${system ? 'system' : ''}`} key={message.id}>
                      {!system && <Avatar name={message.author_name} color={mine ? '#3b7ff5' : '#0f9b8e'} size={30} />}
                      <div className="chat-bubble-wrap">
                        {system ? (
                          <div className="system-message"><Bot size={13} /> {message.body}</div>
                        ) : (
                          <>
                            <div className="chat-meta"><strong>{message.author_name}</strong><span>{message.author_role?.replace('_', ' ')}</span><span>{formatTime(message.created_at)}</span></div>
                            <div className="chat-bubble">{message.body}{message.pendingSync && <span className="pending-label"> · queued offline</span>}</div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="quick-updates">
                <span>Quick update</span>
                {QUICK_UPDATES.map((update) => <button key={update} onClick={() => send(update)}>{update}</button>)}
              </div>

              <div className="chat-input-row large">
                <TextInput
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') send(); }}
                  placeholder="Write a secure update to this incident channel…"
                />
                <Button variant="primary" icon={Send} onClick={() => send()} disabled={!text.trim()}>Send</Button>
              </div>
              <div className="chat-foot"><CheckCircle2 size={12} /> Messages are persisted and delivered instantly to every connected dashboard.</div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
