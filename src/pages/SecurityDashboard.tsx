import React, { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, Monitor, ShieldCheck, Trash2 } from 'lucide-react';
import { get, del } from '../lib/api';
import { useApp } from '../context/AppContext';

interface Session {
  token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
  device_info: string;
  ip_address: string;
  last_activity_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  is_current?: boolean;
}

interface AuditLog {
  id: number;
  user_id: number;
  event_type: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export function SecurityDashboard() {
  const { user, logoutAll } = useApp();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [myActivity, setMyActivity] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin' || user?.role === 'authority';

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, auditRes] = await Promise.all([
        get(isAdmin ? '/auth/admin/sessions' : '/auth/sessions'),
        isAdmin ? get('/auth/security-audit') : Promise.resolve({ logs: [] }),
      ]);
      if (isAdmin) setSessions((sessRes as any).sessions || []);
      else setMyActivity((sessRes as any).sessions || []);
      setAuditLogs((auditRes as any).logs || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const revokeUserSessions = async (userId: number) => {
    if (!confirm('Revoke all sessions for this user?')) return;
    await del(`/auth/admin/sessions/${userId}`);
    loadData();
  };

  const shortDevice = (ua: string) => {
    if (!ua) return 'Unknown Device';
    if (ua.includes('Chrome')) return 'Chrome Browser';
    if (ua.includes('Firefox')) return 'Firefox Browser';
    if (ua.includes('Safari')) return 'Safari Browser';
    return ua.slice(0, 40);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Security Dashboard</h2>
          <p className="page-subtitle">Session management and security monitoring</p>
        </div>
        <button className="btn btn-danger" onClick={logoutAll}>
          <LogOut size={15} /> Sign Out All Devices
        </button>
      </div>

      {loading ? <div className="empty-state"><p>Loading…</p></div> : (
        <>
          {isAdmin ? (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-head"><ShieldCheck size={16} /> Active Sessions (All Users)</div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th><th>Device</th><th>IP</th><th>Last Active</th><th>Expires</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.token}>
                      <td><strong>{s.user_name}</strong><br /><small>{s.user_email}</small></td>
                      <td><Monitor size={12} /> {shortDevice(s.device_info)}</td>
                      <td>{s.ip_address || '—'}</td>
                      <td>{s.last_activity_at ? new Date(s.last_activity_at).toLocaleString('en-IN') : '—'}</td>
                      <td>{new Date(s.expires_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => revokeUserSessions(s.user_id)}>
                          <Trash2 size={12} /> Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={6} className="empty-state">No active sessions.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-head"><Monitor size={16} /> Your Active Sessions</div>
              <table className="data-table">
                <thead><tr><th>Device</th><th>IP</th><th>Last Active</th><th>Expires</th><th></th></tr></thead>
                <tbody>
                  {myActivity.map((s) => (
                    <tr key={s.token} className={s.is_current ? 'row-highlighted' : ''}>
                      <td>{shortDevice(s.device_info)} {s.is_current && <span className="badge badge-success">Current</span>}</td>
                      <td>{s.ip_address || '—'}</td>
                      <td>{s.last_activity_at ? new Date(s.last_activity_at).toLocaleString('en-IN') : '—'}</td>
                      <td>{new Date(s.expires_at).toLocaleDateString('en-IN')}</td>
                      <td>{!s.is_current && <button className="btn btn-sm btn-danger" onClick={() => revokeUserSessions(Number(s.token.replace('…', '')))}>Revoke</button>}</td>
                    </tr>
                  ))}
                  {myActivity.length === 0 && <tr><td colSpan={5} className="empty-state">No sessions found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {isAdmin && auditLogs.length > 0 && (
            <div className="card">
              <div className="card-head"><AlertTriangle size={16} /> Security Audit Log</div>
              <table className="data-table">
                <thead><tr><th>Event</th><th>User</th><th>IP</th><th>Time</th></tr></thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td><span className={`badge ${log.event_type === 'suspicious_login' ? 'badge-warning' : 'badge-info'}`}>{log.event_type}</span></td>
                      <td>{log.user_id || 'Unknown'}</td>
                      <td>{log.ip_address || '—'}</td>
                      <td>{new Date(log.created_at).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
