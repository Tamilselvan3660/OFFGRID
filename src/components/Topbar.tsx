import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, ChevronDown, Clock3, Menu, Radio, Search, Siren, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ROLE_LABEL } from '../lib/permissions';
import { timeAgo } from '../lib/format';
import { Avatar, Badge, SearchInput } from './ui';

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Command Center', subtitle: 'Live situational awareness across the response network' },
  '/incidents': { title: 'Incident Management', subtitle: 'Triage, prioritise and track every emergency report' },
  '/map': { title: 'Live Incident Map', subtitle: 'Real-time positions of incidents, teams and medical facilities' },
  '/communications': { title: 'Communications', subtitle: 'Coordination channels between field teams and command' },
  '/teams': { title: 'Rescue Teams', subtitle: 'Capacity, availability and intelligent team allocation' },
  '/hospitals': { title: 'Hospitals & Care', subtitle: 'Bed, ICU, oxygen and blood availability across the network' },
  '/resources': { title: 'Resource Inventory', subtitle: 'Equipment and relief supplies with low-stock monitoring' },
  '/broadcasts': { title: 'Emergency Broadcasts', subtitle: 'Publish advisories, warnings and critical alerts' },
  '/analytics': { title: 'Emergency Analytics', subtitle: 'Response performance, demand patterns and capacity' },
  '/users': { title: 'Users & Access', subtitle: 'Role-based access for every participant in the network' },
  '/settings': { title: 'Settings', subtitle: 'Profile, offline sync, simulation and platform preferences' },
};

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user, data, isOffline, sseConnected, globalSearch, setGlobalSearch,
    setSosOpen, markNotificationsRead, can, simulateSos,
  } = useApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const meta = PAGE_META[location.pathname] || PAGE_META['/'];
  const unread = data.notifications.filter((item) => !item.read).length;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setNotificationsOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const displayTitle = user?.role === 'citizen' && location.pathname === '/incidents'
    ? 'My Reports'
    : user?.role === 'citizen' && location.pathname === '/broadcasts'
      ? 'Public Alerts'
      : meta.title;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
        <div className="page-heading">
          <div className="breadcrumb"><span>OFFGRID</span><span className="crumb-sep">/</span><span>{meta.title}</span></div>
          <h1>{displayTitle}</h1>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-search">
          <SearchInput
            value={globalSearch}
            onChange={setGlobalSearch}
            placeholder="Search incidents, teams, zones…"
            className="search-input"
          />
          <kbd>⌘K</kbd>
        </div>

        <div className={`live-pill ${sseConnected && !isOffline ? 'live' : 'degraded'}`} title="Real-time event stream status">
          <span className="pulse-dot" />
          <span>{sseConnected && !isOffline ? 'LIVE' : isOffline ? 'OFFLINE' : 'SYNCING'}</span>
        </div>
        {isOffline && <span className="offline-pill"><WifiOff size={13} /> Offline</span>}
        <div className="clock-pill"><Clock3 size={14} /><span>{clock.toLocaleTimeString('en-IN', { hour12: false })}</span></div>

        <div className="topbar-dropdown" ref={notifRef}>
          <button className={`icon-btn notification-btn ${notificationsOpen ? 'active' : ''}`} onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }} aria-label="Notifications">
            <Bell size={18} />
            {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {notificationsOpen && (
            <div className="dropdown-panel notifications-panel">
              <div className="dropdown-head">
                <div><strong>Notifications</strong><small>{unread} unread</small></div>
                <button onClick={() => markNotificationsRead(true)}><CheckCheck size={14} /> Mark all read</button>
              </div>
              <div className="notification-list">
                {data.notifications.length === 0 ? (
                  <div className="dropdown-empty">You're all caught up.</div>
                ) : data.notifications.slice(0, 8).map((item) => (
                  <button className={`notification-item ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => { markNotificationsRead(false, item.id); setNotificationsOpen(false); }}>
                    <span className={`notification-marker tone-${item.kind}`} />
                    <div><strong>{item.title}</strong><p>{item.body}</p><small>{timeAgo(item.created_at)}</small></div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="topbar-dropdown" ref={profileRef}>
          <button className="profile-trigger" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }}>
            <Avatar name={user?.name} color={user?.avatar_color} size={32} />
            <ChevronDown size={14} />
          </button>
          {profileOpen && (
            <div className="dropdown-panel profile-panel">
              <div className="profile-panel-head">
                <Avatar name={user?.name} color={user?.avatar_color} size={42} />
                <div><strong>{user?.name}</strong><small>{user?.email}</small></div>
              </div>
              <Badge tone="blue">{ROLE_LABEL[user?.role as keyof typeof ROLE_LABEL]}</Badge>
              <button className="dropdown-link" onClick={() => { navigate('/settings'); setProfileOpen(false); }}>Account settings</button>
              <button className="dropdown-link" onClick={async () => { await simulateSos(); setProfileOpen(false); }}>Simulate incoming SOS</button>
            </div>
          )}
        </div>

        <button className="sos-button" onClick={() => setSosOpen(true)}>
          <Siren size={17} strokeWidth={2.2} />
          <span>SOS</span>
        </button>
      </div>
    </header>
  );
}
