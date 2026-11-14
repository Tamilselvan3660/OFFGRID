import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RadioTower } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Shell } from './components/Shell';
import { EmptyState } from './components/ui';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Incidents } from './pages/Incidents';
import { MapPage } from './pages/MapPage';
import { Communications } from './pages/Communications';
import { Teams } from './pages/Teams';
import { Hospitals } from './pages/Hospitals';
import { Resources } from './pages/Resources';
import { Broadcasts } from './pages/Broadcasts';
import { Analytics } from './pages/Analytics';
import { Users } from './pages/Users';
import { Settings } from './pages/Settings';
import { Notifications } from './pages/Notifications';
import { LoginActivity } from './pages/LoginActivity';
import { SecurityDashboard } from './pages/SecurityDashboard';
function FullPageLoader() {
  return (
    <div className="full-page-loader">
      <div className="loader-brand"><span className="brand-mark"><RadioTower size={24} /></span><strong>OFF<span>GRID</span></strong></div>
      <div className="loader-bar"><span /></div>
      <p>Connecting to the emergency response network…</p>
    </div>
  );
}

function Protected() {
  const { user, authLoading } = useApp();
  if (authLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function CapabilityGate({ capability, children }: { capability: string; children: React.ReactNode }) {
  const { can } = useApp();
  if (!can(capability)) {
    return (
      <div className="card"><EmptyState title="Access restricted" description="Your current role does not have permission to view this section. Switch to an authorised demo account from Settings." /></div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route element={<Shell />}>
              <Route path="/" element={<Overview />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/map" element={<CapabilityGate capability="map:view"><MapPage /></CapabilityGate>} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/teams" element={<CapabilityGate capability="team:view"><Teams /></CapabilityGate>} />
              <Route path="/hospitals" element={<CapabilityGate capability="hospital:view"><Hospitals /></CapabilityGate>} />
              <Route path="/resources" element={<CapabilityGate capability="resource:view"><Resources /></CapabilityGate>} />
              <Route path="/broadcasts" element={<CapabilityGate capability="broadcast:view"><Broadcasts /></CapabilityGate>} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/analytics" element={<CapabilityGate capability="analytics:view"><Analytics /></CapabilityGate>} />
              <Route path="/users" element={<CapabilityGate capability="user:view"><Users /></CapabilityGate>} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login-activity" element={<LoginActivity />} />
              <Route path="/security" element={<SecurityDashboard />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
