import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BrainCircuit, CheckCircle2, HeartPulse, LockKeyhole,
  MapPinned, MessageSquareText, RadioTower, ShieldCheck, Siren, UsersRound, WifiOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { Avatar, Button, Field, Select, TextInput } from '../components/ui';

const DEMO_ACCOUNTS = [
  { email: 'admin@offgrid.in', role: 'Platform Administrator', name: 'Aarav Menon', color: '#f26430', capability: 'Full platform control' },
  { email: 'authority@offgrid.in', role: 'Disaster Authority', name: 'Meera Iyer', color: '#3b7ff5', capability: 'Command & allocation' },
  { email: 'responder@offgrid.in', role: 'Emergency Responder', name: 'Karthik Raj', color: '#0f9b8e', capability: 'Field missions & teams' },
  { email: 'hospital@offgrid.in', role: 'Hospital Coordinator', name: 'Dr. Priya Nair', color: '#a263e8', capability: 'Capacity & patient flow' },
  { email: 'medical@offgrid.in', role: 'Medical Team', name: 'Dr. Arjun Selvan', color: '#e5484d', capability: 'Triage & medical updates' },
  { email: 'citizen@offgrid.in', role: 'Citizen', name: 'Ananya Krishnan', color: '#e9a426', capability: 'SOS & offline reports' },
];

const FEATURES = [
  { icon: Siren, label: 'Smart SOS with live GPS' },
  { icon: BrainCircuit, label: 'AI triage, duplicates & priorities' },
  { icon: UsersRound, label: 'Intelligent rescue allocation' },
  { icon: WifiOff, label: 'Offline-first emergency reporting' },
  { icon: MessageSquareText, label: 'Real-time incident channels' },
  { icon: Activity, label: 'Live tracking & analytics' },
];

export function Login() {
  const { login, register, user, authLoading, pushToast } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@offgrid.in');
  const [password, setPassword] = useState('Demo@123');
  const [form, setForm] = useState({ name: '', email: '', phone: '', zone: 'Central Chennai', password: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && user) navigate('/', { replace: true }); }, [authLoading, user, navigate]);

  const doLogin = async (loginEmail = email, loginPassword = password) => {
    setError(null);
    setBusy(loginEmail);
    try {
      const account = await login(loginEmail, loginPassword);
      pushToast({ title: `Welcome back, ${account.name.split(' ')[0]}`, description: 'Live incident data is connected.', tone: 'success' });
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doRegister = async () => {
    setError(null);
    setBusy('register');
    try {
      await register(form);
      pushToast({ title: 'Account created', description: 'Your citizen reporter profile is ready.', tone: 'success' });
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-aside">
        <div className="auth-brand">
          <span className="auth-brand-mark"><RadioTower size={22} /></span>
          <div><strong>OFF<span>GRID</span></strong><small>Emergency Response Network</small></div>
        </div>
        <div className="auth-hero">
          <span className="auth-eyebrow"><span className="pulse-dot live" /> SYSTEM OPERATIONAL</span>
          <h1>When the grid fails,<br /><em>coordination must not.</em></h1>
          <p>One command layer for citizens, field responders, hospitals and disaster authorities — built to keep working when connectivity does not.</p>
        </div>
        <div className="auth-visual">
          <div className="auth-visual-grid" />
          <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" /><div className="auth-orbit orbit-three" />
          <div className="auth-node node-command"><ShieldCheck size={20} /><span>COMMAND</span></div>
          <div className="auth-node node-field"><MapPinned size={19} /><span>FIELD</span></div>
          <div className="auth-node node-care"><HeartPulse size={19} /><span>CARE</span></div>
          <div className="auth-node node-citizen"><Siren size={19} /><span>SOS</span></div>
          <div className="auth-center"><RadioTower size={30} /></div>
        </div>
        <div className="auth-features">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return <div className="auth-feature" key={feature.label}><Icon size={15} /><span>{feature.label}</span></div>;
          })}
        </div>
        <div className="auth-aside-foot"><span>Chennai Regional Emergency Network</span><span>Node 04 · 2026</span></div>
      </div>

      <div className="auth-content">
        <div className="auth-form-wrap">
          <div className="auth-form-head">
            <h2>{mode === 'login' ? 'Sign in to OFFGRID' : 'Create a citizen account'}</h2>
            <p>{mode === 'login' ? 'Access the live emergency coordination workspace.' : 'Report emergencies, share GPS and stay connected offline.'}</p>
          </div>

          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(null); }}>Register</button>
          </div>

          {mode === 'login' ? (
            <>
              <div className="auth-fields">
                <Field label="Email address" required>
                  <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@offgrid.in" />
                </Field>
                <Field label="Password" required>
                  <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" onKeyDown={(event) => { if (event.key === 'Enter') doLogin(); }} />
                </Field>
              </div>
              {error && <div className="form-error">{error}</div>}
              <Button variant="primary" size="lg" icon={ArrowRight} loading={busy === email} onClick={() => doLogin()} className="auth-submit">Sign in securely</Button>
              <div className="auth-demo-head"><span>Explore as a demo role</span><small>One click · password Demo@123</small></div>
              <div className="demo-accounts">
                {DEMO_ACCOUNTS.map((account) => (
                  <button key={account.email} className="demo-account" onClick={() => doLogin(account.email, 'Demo@123')} disabled={Boolean(busy)}>
                    <Avatar name={account.name} color={account.color} size={34} />
                    <div className="demo-account-text"><strong>{account.role}</strong><small>{account.capability}</small></div>
                    {busy === account.email ? <span className="demo-loading" /> : <ArrowRight size={15} />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="auth-fields">
                <Field label="Full name" required><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></Field>
                <Field label="Email address" required><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></Field>
                <Field label="Phone number"><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 …" /></Field>
                <Field label="Home zone"><Select value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })}>{ZONES.map((zone) => <option key={zone}>{zone}</option>)}</Select></Field>
                <Field label="Password" required hint="At least 6 characters."><TextInput type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="••••••••" /></Field>
              </div>
              {error && <div className="form-error">{error}</div>}
              <Button variant="primary" size="lg" icon={CheckCircle2} loading={busy === 'register'} onClick={doRegister} className="auth-submit">Create account</Button>
              <div className="auth-note"><LockKeyhole size={14} /> Citizen accounts can submit SOS reports, share GPS and track their own incidents.</div>
            </>
          )}

          <div className="auth-footer-note"><span className="pulse-dot live" /> Persistent demo data · real-time event stream · on-device AI</div>
        </div>
      </div>
    </div>
  );
}
