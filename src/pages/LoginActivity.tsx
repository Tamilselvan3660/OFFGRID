import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, MapPin, Monitor, XCircle } from 'lucide-react';
import { get } from '../lib/api';

interface LoginRecord {
  id: number;
  success: number;
  ip_address: string;
  device_info: string;
  timestamp: string;
  failure_reason: string | null;
}

export function LoginActivity() {
  const [activity, setActivity] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    get(`/auth/login-activity?filter=${filter}&page=${page}`)
      .then((res: any) => {
        setActivity(res.activity || []);
        setTotal(res.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, page]);

  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleString('en-IN'); } catch { return ts; }
  };

  const shortDevice = (ua: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return ua.slice(0, 30);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Login Activity</h2>
          <p className="page-subtitle">Recent sign-in history for your account</p>
        </div>
      </div>

      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        {(['all', 'success', 'failed'] as const).map((f) => (
          <button
            key={f}
            className={`tab-btn ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'all' ? 'All Activity' : f === 'success' ? 'Successful' : 'Failed Attempts'}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state"><p>Loading activity…</p></div>
        ) : activity.length === 0 ? (
          <div className="empty-state"><Activity size={32} /><p>No login activity found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Date &amp; Time</th>
                <th>Device</th>
                <th>IP Address</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={`badge ${row.success ? 'badge-success' : 'badge-error'}`}>
                      {row.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {row.success ? ' Success' : ' Failed'}
                    </span>
                  </td>
                  <td><Clock size={12} /> {formatDate(row.timestamp)}</td>
                  <td><Monitor size={12} /> {shortDevice(row.device_info)}</td>
                  <td><MapPin size={12} /> {row.ip_address || '—'}</td>
                  <td>{row.failure_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 20 && (
          <div className="pagination" style={{ padding: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span style={{ padding: '0.25rem 0.5rem' }}>Page {page}</span>
            <button className="btn btn-sm" disabled={activity.length < 20} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
