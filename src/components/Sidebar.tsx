import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity, BarChart3, BellRing, ChevronRight, HeartPulse, LayoutDashboard,
  MapPinned, Megaphone, MessageSquareText, Package, RadioTower, Settings2,
  ShieldCheck, Siren, UsersRound, WifiOff, X, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ROLE_LABEL } from '../lib/permissions';
import { Avatar, Toggle } from './ui';

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Command Center', icon: LayoutDashboard, capability: null, end: true },
      { to: '/incidents', label: 'Incidents', icon: Siren, capability: 'incident:view', citizenLabel: 'My Reports' },
      { to: '/map', label: 'Live Map', icon: MapPinned, capability: 'map:view' },
      { to: '/communications', label: 'Communications', icon: MessageSquareText, capability: null },
    ],
  },
  {
    label: 'Coordination',
    items: [
      { to: '/teams', label: 'Rescue Teams', icon: UsersRound, capability: 'team:view' },
      { to: '/hospitals', label: 'Hospitals & Care', icon: HeartPulse, capability: 'hospital:view' },
      { to: '/resources', label: 'Resources', icon: Package, capability: 'resource:view' },
      { to: '/broadcasts', label: 'Broadcasts', icon: Megaphone, capability: 'broadcast:view', citizenLabel: 'Public Alerts' },
    ],
  },
  {
    label: 'Insights & system',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, capability: 'analytics:view' },
      { to: '/users', label: 'Users & Access', icon: ShieldCheck, capability: 'user:view' },
      { to: '/settings', label: 'Settings', icon: Settings2, capability: null },
    ],
  },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, can, isOffline, offlineMode, setOfflineMode, data, sseConnected } = useApp();
  const activeCount = data.incidents.filter((incident) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status)).length;
  const duplicateCount = data.incidents.filter((incident) => incident.duplicate_of && incident.status !== 'duplicate').length;

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><RadioTower size={20} strokeWidth={2.3} /></div>
          <div className="brand-text">
            <strong>OFF<span>GRID</span></strong>
            <small>Emergency Response Network</small>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="sidebar-network">
          <span className={`pulse-dot ${sseConnected ? 'live' : 'offline'}`} />
          <div>
            <strong>{sseConnected ? 'Network connected' : 'Reconnecting…'}</strong>
            <small>Chennai Regional · Node 04</small>
          </div>
          <ChevronRight size={14} />
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.capability || can(item.capability));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const label = user?.role === 'citizen' && item.citizenLabel ? item.citizenLabel : item.label;
                  const badge = item.to === '/incidents' ? activeCount : item.to === '/analytics' ? duplicateCount : null;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={18} strokeWidth={1.9} />
                      <span>{label}</span>
                      {badge ? <span className="nav-badge">{badge}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-quick">
            <div className="sidebar-quick-head"><Zap size={14} /><span>Quick status</span></div>
            <div className="sidebar-quick-row"><span>Active incidents</span><strong>{activeCount}</strong></div>
            <div className="sidebar-quick-row"><span>Duplicate flags</span><strong>{duplicateCount}</strong></div>
            <div className="sidebar-quick-row"><span>Teams deployed</span><strong>{data.teams.filter((team) => team.status === 'deployed').length}/{data.teams.length}</strong></div>
          </div>
          <div className={`offline-box ${isOffline ? 'active' : ''}`}>
            <div className="offline-box-head">
              {isOffline ? <WifiOff size={15} /> : <Activity size={15} />}
              <span>{isOffline ? 'Working offline' : 'Connectivity'}</span>
            </div>
            <Toggle
              checked={offlineMode}
              onChange={setOfflineMode}
              label="Force offline mode"
              description="Queue reports on this device"
            />
          </div>
          <div className="sidebar-user">
            <Avatar name={user?.name} color={user?.avatar_color} size={36} />
            <div className="sidebar-user-text">
              <strong>{user?.name}</strong>
              <small>{ROLE_LABEL[user?.role as keyof typeof ROLE_LABEL] || 'Member'}</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
