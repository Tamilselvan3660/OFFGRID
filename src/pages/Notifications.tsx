import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertOctagon, AlertTriangle, ArrowUpDown, Bell, BellOff, BellRing,
  Check, CheckCheck, CheckCircle2, ChevronRight, Clock, Clock3,
  Download, ExternalLink, Filter, Flame, HardDrive, History, Mail,
  MailCheck, MailX, MessageSquare, Radio, RefreshCw, RotateCcw,
  Search, Send, Server, ShieldAlert, ShieldCheck, Siren, Trash2,
  TrendingUp, Users, Wifi, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { get, post, patch } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/format';
import {
  NotificationItem, NotificationDeliveryLog, NotificationEscalation,
  NotificationMonitoringStats,
} from '../lib/types';
import {
  Avatar, Badge, Button, Card, CardHead, EmptyState, Modal,
  ProgressBar, SearchInput, Select, SeverityBadge, Skeleton,
  StatCard, StatusBadge, TextInput, Toggle,
} from '../components/ui';

type TabKey =
  | 'all'
  | 'unread'
  | 'sos'
  | 'updates'
  | 'assignments'
  | 'escalations'
  | 'failed'
  | 'monitoring';

export function Notifications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    data, user, markNotificationsRead, deleteNotification, setOpenIncidentId,
    pushToast, can,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabKey>(
    (searchParams.get('tab') as TabKey) || 'all',
  );
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Delivery monitoring state
  const [monitoring, setMonitoring] = useState<NotificationMonitoringStats | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [escalations, setEscalations] = useState<NotificationEscalation[]>([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);

  // SMTP test modal
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<any | null>(null);

  // Manual Escalate dialog
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<NotificationEscalation | null>(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [escalating, setEscalating] = useState(false);

  // Retrying state
  const [retryingLogId, setRetryingLogId] = useState<number | null>(null);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabKey;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const loadMonitoring = async () => {
    try {
      const res = await get('/notifications/status');
      if (res?.monitoring) setMonitoring(res.monitoring);
    } catch {
      /* ignore */
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedChannel !== 'all') params.append('channel', selectedChannel);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (search.trim()) params.append('q', search.trim());
      params.append('limit', '50');

      const res = await get(`/notifications/history?${params.toString()}`);
      if (res?.logs) {
        setDeliveryLogs(res.logs);
        setLogsTotal(res.total || 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLogsLoading(false);
    }
  };

  const loadEscalations = async () => {
    setEscalationsLoading(true);
    try {
      const res = await get('/notifications/escalations');
      if (res?.escalations) setEscalations(res.escalations);
    } catch {
      /* ignore */
    } finally {
      setEscalationsLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoring();
    if (activeTab === 'monitoring' || activeTab === 'failed') loadLogs();
    if (activeTab === 'escalations') loadEscalations();
  }, [activeTab, selectedStatus, selectedChannel, selectedSeverity]);

  // Real-time refresh
  useEffect(() => {
    const timer = setInterval(() => {
      loadMonitoring();
      if (activeTab === 'monitoring' || activeTab === 'failed') loadLogs();
      if (activeTab === 'escalations') loadEscalations();
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const runSmtpTest = async (sendEmail = false) => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await post('/notifications/test', {
        email: testEmail,
        send_email: sendEmail,
      });
      setSmtpTestResult(res);
      if (res.connection?.connected) {
        pushToast({
          title: sendEmail ? 'Test email dispatched' : 'SMTP connected',
          description: sendEmail ? `Sent verification to ${testEmail}` : res.connection.message,
          tone: 'success',
        });
      } else {
        pushToast({
          title: 'SMTP connection failed',
          description: res.connection?.error || 'Verification failed',
          tone: 'error',
        });
      }
      loadMonitoring();
    } catch (err: any) {
      pushToast({ title: 'Test failed', description: err.message, tone: 'error' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleRetryDelivery = async (logId: number) => {
    setRetryingLogId(logId);
    try {
      await post(`/notifications/${logId}/retry`);
      pushToast({
        title: 'Delivery re-enqueued',
        description: 'Notification job re-added to priority queue.',
        tone: 'success',
      });
      loadLogs();
      loadMonitoring();
    } catch (err: any) {
      pushToast({ title: 'Retry failed', description: err.message, tone: 'error' });
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleAdvanceEscalation = async () => {
    if (!selectedEscalation) return;
    setEscalating(true);
    try {
      await post(`/notifications/escalations/${selectedEscalation.id}/trigger`, {
        note: escalationNote || 'Manual escalation invoked by operator',
      });
      pushToast({
        title: 'Emergency escalated',
        description: `Advanced to Stage ${selectedEscalation.stage + 1}`,
        tone: 'success',
      });
      setEscalateModalOpen(false);
      setSelectedEscalation(null);
      setEscalationNote('');
      loadEscalations();
    } catch (err: any) {
      pushToast({ title: 'Escalation failed', description: err.message, tone: 'error' });
    } finally {
      setEscalating(false);
    }
  };

  const exportDeliveryLogs = () => {
    if (!deliveryLogs.length) return;
    const headers = ['id', 'event_id', 'incident_id', 'recipient_name', 'recipient_address', 'channel', 'severity', 'priority', 'status', 'retry_count', 'error_message', 'created_at', 'delivered_at'];
    const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...deliveryLogs.map((row: any) => headers.map((key) => escape(row[key])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offgrid-notifications-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter in-app notifications
  const filteredNotifications = useMemo(() => {
    return data.notifications.filter((n) => {
      // Tab filter
      if (activeTab === 'unread' && n.read) return false;
      if (activeTab === 'sos' && n.category !== 'sos' && n.kind !== 'critical') return false;
      if (activeTab === 'updates' && n.category !== 'status_change') return false;
      if (activeTab === 'assignments' && n.category !== 'assignment') return false;

      // Text search
      if (search.trim()) {
        const term = search.toLowerCase();
        const matches = n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term);
        if (!matches) return false;
      }

      return true;
    });
  }, [data.notifications, activeTab, search]);

  const unreadTotal = data.notifications.filter((n) => !n.read).length;
  const sosTotal = data.notifications.filter((n) => n.category === 'sos' || n.kind === 'critical').length;

  return (
    <div className="page-stack notifications-page">
      {/* Top Banner KPI Grid */}
      <div className="analytics-kpi-grid">
        <StatCard
          label="Total Notifications"
          value={monitoring?.totalDeliveries ?? data.notifications.length}
          icon={Bell}
          tone="navy"
          hint="Dispatched across all channels"
        />
        <StatCard
          label="SMTP Outbound"
          value={monitoring?.acceptedEmails ?? 0}
          icon={MailCheck}
          tone="green"
          hint={monitoring?.smtpStatus?.configured ? `${monitoring.smtpStatus.provider.toUpperCase()} active` : 'SMTP offline'}
        />
        <StatCard
          label="Critical Emergencies"
          value={monitoring?.criticalNotifications ?? sosTotal}
          icon={Siren}
          tone="red"
          hint="Immediate priority dispatched"
        />
        <StatCard
          label="Queue Health"
          value={monitoring?.queueStatus?.pendingJobs ?? 0}
          icon={HardDrive}
          tone={monitoring?.queueStatus?.failedJobs ? 'orange' : 'teal'}
          hint={`${monitoring?.queueStatus?.avgProcessingTimeMs ?? 180}ms avg latency · ${monitoring?.queueStatus?.failedJobs ?? 0} failed`}
        />
      </div>

      {/* Main Container Card */}
      <Card className="notif-center-card">
        <div className="notif-center-head">
          <div className="notif-tabs">
            <button
              className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => switchTab('all')}
            >
              <Bell size={15} />
              <span>All Notifications</span>
              <span className="tab-pill">{data.notifications.length}</span>
            </button>
            <button
              className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => switchTab('unread')}
            >
              <BellRing size={15} />
              <span>Unread</span>
              {unreadTotal > 0 && <span className="tab-pill tone-orange">{unreadTotal}</span>}
            </button>
            <button
              className={`notif-tab ${activeTab === 'sos' ? 'active' : ''}`}
              onClick={() => switchTab('sos')}
            >
              <Siren size={15} />
              <span>SOS Alerts</span>
              {sosTotal > 0 && <span className="tab-pill tone-red">{sosTotal}</span>}
            </button>
            <button
              className={`notif-tab ${activeTab === 'assignments' ? 'active' : ''}`}
              onClick={() => switchTab('assignments')}
            >
              <Users size={15} />
              <span>Team Assignments</span>
            </button>
            <button
              className={`notif-tab ${activeTab === 'updates' ? 'active' : ''}`}
              onClick={() => switchTab('updates')}
            >
              <RefreshCw size={15} />
              <span>Status Updates</span>
            </button>
            <button
              className={`notif-tab ${activeTab === 'escalations' ? 'active' : ''}`}
              onClick={() => switchTab('escalations')}
            >
              <TrendingUp size={15} />
              <span>Escalations</span>
              {escalations.filter((e) => e.status === 'active').length > 0 && (
                <span className="tab-pill tone-red">
                  {escalations.filter((e) => e.status === 'active').length}
                </span>
              )}
            </button>
            <button
              className={`notif-tab ${activeTab === 'failed' ? 'active' : ''}`}
              onClick={() => switchTab('failed')}
            >
              <MailX size={15} />
              <span>Failed Deliveries</span>
              {(monitoring?.failedNotifications ?? 0) > 0 && (
                <span className="tab-pill tone-red">{monitoring?.failedNotifications}</span>
              )}
            </button>
            <button
              className={`notif-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => switchTab('monitoring')}
            >
              <Server size={15} />
              <span>Delivery Audit & Monitoring</span>
            </button>
          </div>

          <div className="notif-head-actions">
            {activeTab !== 'monitoring' && activeTab !== 'failed' && activeTab !== 'escalations' && (
              <Button
                variant="outline"
                size="sm"
                icon={CheckCheck}
                onClick={() => markNotificationsRead(true)}
                disabled={unreadTotal === 0}
              >
                Mark all read
              </Button>
            )}
            {can('settings:manage') && (
              <Button
                variant="outline"
                size="sm"
                icon={Server}
                onClick={() => setSmtpModalOpen(true)}
              >
                Test SMTP Relay
              </Button>
            )}
            {(activeTab === 'monitoring' || activeTab === 'failed') && (
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                onClick={exportDeliveryLogs}
                disabled={!deliveryLogs.length}
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar for in-app or logs */}
        <div className="notif-filter-bar">
          <div className="row gap-8 flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search notifications, incident codes, recipients…"
            />
          </div>

          {(activeTab === 'monitoring' || activeTab === 'failed') && (
            <div className="row gap-8">
              <Select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="select-sm"
              >
                <option value="all">All Channels</option>
                <option value="email">SMTP Email</option>
                <option value="in_app">In-App Notification</option>
                <option value="sms">SMS Gateway</option>
              </Select>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="select-sm"
              >
                <option value="all">All Statuses</option>
                <option value="accepted">Accepted / Delivered</option>
                <option value="queued">Queued in Worker</option>
                <option value="retrying">Retrying Backoff</option>
                <option value="failed">Failed / Dead-letter</option>
              </Select>
            </div>
          )}
        </div>

        {/* TAB CONTENT: Escalations */}
        {activeTab === 'escalations' && (
          <div className="escalations-container">
            <div className="section-intro">
              <div className="section-title">
                <Siren size={18} className="text-orange" />
                <strong>Automated Multi-Stage Emergency Escalation</strong>
              </div>
              <p>
                Unacknowledged high-severity emergencies automatically escalate through 4 tiers of authority until formally acknowledged.
              </p>
            </div>

            {escalationsLoading ? (
              <div className="page-stack">
                <Skeleton height={60} />
                <Skeleton height={60} />
              </div>
            ) : escalations.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No active emergency escalations"
                description="All high-priority incidents are acknowledged within their response SLA."
              />
            ) : (
              <div className="escalation-list">
                {escalations.map((esc) => (
                  <div key={esc.id} className={`escalation-card stage-${esc.stage} status-${esc.status}`}>
                    <div className="escalation-header">
                      <div className="row gap-8 items-center">
                        <span className="mono font-bold text-orange">{esc.incident_code || `INC-${esc.incident_id}`}</span>
                        <SeverityBadge severity={esc.incident_severity || 5} />
                        <span className={`escalation-stage-badge stage-${esc.stage}`}>
                          Stage {esc.stage} of 4
                        </span>
                        <Badge tone={esc.status === 'active' ? 'red' : 'green'}>
                          {esc.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="escalation-actions">
                        {esc.status === 'active' && can('incident:assign') && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={TrendingUp}
                            onClick={() => {
                              setSelectedEscalation(esc);
                              setEscalateModalOpen(true);
                            }}
                          >
                            Advance Escalation
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          icon={ExternalLink}
                          onClick={() => setOpenIncidentId(esc.incident_id)}
                        >
                          View Incident
                        </Button>
                      </div>
                    </div>

                    <div className="escalation-body">
                      <strong>{esc.incident_title || 'Emergency Incident'}</strong>
                      <div className="escalation-meta-grid">
                        <div>
                          <small>Current Escalation Target</small>
                          <p>{esc.current_target_name} ({esc.current_target_role})</p>
                        </div>
                        <div>
                          <small>Triggered At</small>
                          <p>{formatDateTime(esc.triggered_at)}</p>
                        </div>
                        <div>
                          <small>Stage SLA Threshold</small>
                          <p>{esc.threshold_minutes} minutes</p>
                        </div>
                        <div>
                          <small>Status Note</small>
                          <p>{esc.notes || 'Automated escalation active'}</p>
                        </div>
                      </div>

                      {/* Escalation History Timeline */}
                      {esc.history && esc.history.length > 0 && (
                        <div className="escalation-history">
                          <small className="history-label">Escalation Audit Trail:</small>
                          <div className="timeline-steps">
                            {esc.history.map((step, idx) => (
                              <div key={idx} className="timeline-step">
                                <span className="timeline-dot" />
                                <div className="timeline-content">
                                  <strong>{step.action ? `${step.action.toUpperCase()} by ${step.by}` : `Stage ${step.stage}: ${step.targetRole}`}</strong>
                                  <span className="timeline-time">{timeAgo(step.triggeredAt || step.at || '')}</span>
                                  {step.reason && <p className="timeline-reason">{step.reason}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: Failed Deliveries & Delivery Monitoring Audit */}
        {(activeTab === 'monitoring' || activeTab === 'failed') && (
          <div className="monitoring-container">
            {/* System Engine Health Card */}
            <div className="monitoring-engine-grid">
              <div className="engine-card">
                <div className="engine-card-head">
                  <Mail size={16} />
                  <strong>SMTP Relay Status</strong>
                  <Badge tone={monitoring?.smtpStatus?.configured ? 'green' : 'amber'}>
                    {monitoring?.smtpStatus?.configured ? 'ONLINE' : 'UNCONFIGURED'}
                  </Badge>
                </div>
                <div className="engine-details">
                  <div><span>Host:</span> <strong className="mono">{monitoring?.smtpStatus?.host}</strong></div>
                  <div><span>Port:</span> <strong>{monitoring?.smtpStatus?.port} (TLS: {monitoring?.smtpStatus?.secure ? 'SSL 465' : 'STARTTLS 587'})</strong></div>
                  <div><span>Sender:</span> <strong>{monitoring?.smtpStatus?.fromEmail}</strong></div>
                  <div><span>Account:</span> <strong className="mono">{monitoring?.smtpStatus?.maskedUser || '(none)'}</strong></div>
                </div>
              </div>

              <div className="engine-card">
                <div className="engine-card-head">
                  <HardDrive size={16} />
                  <strong>Notification Worker Queue</strong>
                  <Badge tone="green">ACTIVE (POLLING 3.5s)</Badge>
                </div>
                <div className="engine-details">
                  <div><span>Pending Jobs:</span> <strong>{monitoring?.queueStatus?.pendingJobs ?? 0}</strong></div>
                  <div><span>Active Processing:</span> <strong>{monitoring?.queueStatus?.processingJobs ?? 0}</strong></div>
                  <div><span>Failed / Dead-Letter:</span> <strong>{monitoring?.queueStatus?.failedJobs ?? 0}</strong></div>
                  <div><span>Average Processing:</span> <strong>{monitoring?.queueStatus?.avgProcessingTimeMs ?? 180} ms</strong></div>
                </div>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="audit-table-wrapper">
              {logsLoading ? (
                <div className="page-stack">
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                  <Skeleton height={48} />
                </div>
              ) : deliveryLogs.length === 0 ? (
                <EmptyState
                  icon={MailCheck}
                  title="No delivery records found"
                  description="When notifications are dispatched across SMTP, In-App, or SMS, their delivery tracking appears here."
                />
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event ID</th>
                      <th>Channel</th>
                      <th>Recipient</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Retries</th>
                      <th>Response / Error</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryLogs.map((log) => (
                      <tr key={log.id} className={log.status === 'failed' ? 'row-failed' : ''}>
                        <td>
                          <div className="cell-main">{timeAgo(log.created_at)}</div>
                          <div className="cell-sub">{new Date(log.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td>
                          <span className="mono text-xs font-semibold">{log.event_id}</span>
                          {log.incident_id && (
                            <div>
                              <button
                                className="link-button text-xs"
                                onClick={() => setOpenIncidentId(log.incident_id as number)}
                              >
                                View Incident #{log.incident_id}
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`channel-pill channel-${log.channel}`}>
                            {log.channel === 'email' ? 'SMTP EMAIL' : log.channel.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong>{log.recipient_name || log.recipient_address}</strong>
                          <div className="cell-sub text-xs">{log.recipient_address}</div>
                        </td>
                        <td>
                          <SeverityBadge severity={log.severity} />
                        </td>
                        <td>
                          <span className={`delivery-status-pill status-${log.status}`}>
                            {log.status === 'accepted' ? 'Accepted by SMTP' : log.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {log.retry_count > 0 ? (
                            <span className="badge-retry">{log.retry_count} / {log.max_retries}</span>
                          ) : (
                            <span className="cell-sub">—</span>
                          )}
                        </td>
                        <td className="log-response-cell">
                          {log.status === 'failed' ? (
                            <span className="text-red font-mono text-xs">{log.error_message || 'Delivery rejected'}</span>
                          ) : log.provider_response ? (
                            <span className="cell-sub font-mono text-xs">{log.provider_response.slice(0, 50)}</span>
                          ) : (
                            <span className="cell-sub">—</span>
                          )}
                        </td>
                        <td>
                          {log.status === 'failed' && can('settings:manage') ? (
                            <Button
                              size="sm"
                              variant="outline"
                              icon={RotateCcw}
                              loading={retryingLogId === log.id}
                              onClick={() => handleRetryDelivery(log.id)}
                            >
                              Retry
                            </Button>
                          ) : (
                            <span className="cell-sub">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT: In-App Notifications List */}
        {activeTab !== 'monitoring' && activeTab !== 'failed' && activeTab !== 'escalations' && (
          <div className="notif-list-container">
            {filteredNotifications.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="No notifications to display"
                description={
                  activeTab === 'unread'
                    ? "You're all caught up! No unread notifications."
                    : activeTab === 'sos'
                    ? 'No SOS emergency alerts logged.'
                    : 'Emergency notifications and team broadcasts will appear here in real time.'
                }
              />
            ) : (
              <div className="notif-feed">
                {filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    className={`notif-card ${item.read ? 'read' : 'unread'} kind-${item.kind}`}
                  >
                    <div className="notif-marker" />
                    <div className="notif-icon-col">
                      <span className={`notif-kind-icon tone-${item.kind}`}>
                        {item.category === 'sos' || item.kind === 'critical' ? (
                          <Siren size={18} />
                        ) : item.category === 'assignment' ? (
                          <Users size={18} />
                        ) : item.category === 'public_alert' ? (
                          <Radio size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </span>
                    </div>

                    <div className="notif-content-col">
                      <div className="notif-title-row">
                        <strong className="notif-title">{item.title}</strong>
                        <div className="notif-meta-tags">
                          {item.category && (
                            <span className="notif-cat-tag">
                              {item.category.replace('_', ' ')}
                            </span>
                          )}
                          <span className="notif-time">{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                      <p className="notif-body">{item.body}</p>

                      <div className="notif-actions-row">
                        {item.link && (
                          <button
                            className="btn-link"
                            onClick={() => {
                              markNotificationsRead(false, item.id);
                              navigate(item.link as string);
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>Open Incident</span>
                          </button>
                        )}
                        {!item.read && (
                          <button
                            className="btn-ghost"
                            onClick={() => markNotificationsRead(false, item.id)}
                          >
                            <Check size={13} />
                            <span>Mark read</span>
                          </button>
                        )}
                        <button
                          className="btn-ghost btn-trash"
                          onClick={() => deleteNotification(item.id)}
                          title="Archive notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* MODAL: SMTP Connection Test & Verification */}
      {smtpModalOpen && (
        <Modal
          open={true}
          title="SMTP Email Infrastructure Diagnostics"
          subtitle="Validate SMTP host credentials, TLS encryption, and deliverability"
          onClose={() => setSmtpModalOpen(false)}
        >
          <div className="form-grid">
            <div className="smtp-info-box span-2">
              <div className="row gap-8 items-center">
                <Server size={18} className="text-orange" />
                <strong>Configured Outbound Provider:</strong>
                <Badge tone="blue">{monitoring?.smtpStatus?.provider?.toUpperCase() || 'CUSTOM'}</Badge>
              </div>
              <p className="text-xs text-sub mt-4">
                Host: {monitoring?.smtpStatus?.host} &bull; Port: {monitoring?.smtpStatus?.port} &bull; User: {monitoring?.smtpStatus?.maskedUser || '(not configured in .env)'}
              </p>
            </div>

            <div className="field span-2">
              <label>Verification Recipient Email Address</label>
              <TextInput
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
              />
              <small className="hint">
                Enter an email address to verify real outbound SMTP transmission.
              </small>
            </div>

            {smtpTestResult && (
              <div
                className={`smtp-result-box span-2 ${
                  smtpTestResult.connection?.connected ? 'success' : 'error'
                }`}
              >
                <strong>
                  {smtpTestResult.connection?.connected
                    ? '✅ SMTP Connection Verified'
                    : '❌ SMTP Verification Failed'}
                </strong>
                <p>{smtpTestResult.connection?.message || smtpTestResult.connection?.error}</p>
                {smtpTestResult.emailResult && (
                  <div className="mt-8 text-xs font-mono">
                    Email Accepted: {String(smtpTestResult.emailResult.accepted)}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions span-2">
              <Button
                variant="outline"
                onClick={() => runSmtpTest(false)}
                loading={testingSmtp}
              >
                Verify Connection Only
              </Button>
              <Button
                variant="primary"
                icon={Send}
                onClick={() => runSmtpTest(true)}
                loading={testingSmtp}
              >
                Send Test Email
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Manual Advance Escalation */}
      {escalateModalOpen && selectedEscalation && (
        <Modal
          open={true}
          title={`Manual Escalation: ${selectedEscalation.incident_code || `INC-${selectedEscalation.incident_id}`}`}
          subtitle={`Advance emergency from Stage ${selectedEscalation.stage} to Stage ${Math.min(4, selectedEscalation.stage + 1)}`}
          onClose={() => setEscalateModalOpen(false)}
        >
          <div className="form-grid">
            <div className="escalate-alert span-2">
              <AlertTriangle size={18} className="text-red" />
              <div>
                <strong>Executive Action Required</strong>
                <p>
                  Manually advancing this escalation will notify higher-tier regional authorities and administrators immediately across Email, In-App, and SSE.
                </p>
              </div>
            </div>

            <div className="field span-2">
              <label>Reason / Escalation Note</label>
              <TextInput
                value={escalationNote}
                onChange={(e) => setEscalationNote(e.target.value)}
                placeholder="e.g. Field team unresponsive; critical flood rising; command intervention needed."
              />
            </div>

            <div className="modal-actions span-2">
              <Button variant="outline" onClick={() => setEscalateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={TrendingUp}
                loading={escalating}
                onClick={handleAdvanceEscalation}
              >
                Confirm Escalation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
