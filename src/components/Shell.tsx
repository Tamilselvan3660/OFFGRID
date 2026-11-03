import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastStack } from './ui';
import { SosModal } from './SosModal';
import { IncidentDrawer } from './IncidentDrawer';

export function Shell() {
  const { toasts, dismissToast, isOffline, queue, syncing, setSosOpen } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // PWA shortcut: /?action=sos opens the Smart SOS dialog on launch.
    if (new URLSearchParams(window.location.search).get('action') === 'sos') {
      setSosOpen(true);
    }
  }, [setSosOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.topbar-search input')?.focus();
      }
      if (event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSosOpen(true);
      }
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.topbar-search input')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setSosOpen]);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        {isOffline && (
          <div className="offline-strip">
            <WifiOff size={15} />
            <strong>Offline mode</strong>
            <span>Reports and messages are stored on this device{syncing ? ' · syncing now…' : queue.length ? ` · ${queue.length} queued` : ''}.</span>
            <button onClick={() => navigate('/settings')}>Manage queue</button>
          </div>
        )}
        <main className="page"><Outlet /></main>
        <footer className="app-footer">
          <span>© 2026 OFFGRID · Chennai Regional Emergency Network</span>
          <span>Persistent SQLite storage · Real-time SSE · On-device AI triage</span>
        </footer>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <SosModal />
      <IncidentDrawer />
    </div>
  );
}
