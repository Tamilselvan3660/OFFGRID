import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { ApiError, ENDPOINTS, SINGULAR, del, get, patch, post } from '../lib/api';
import { roleCan } from '../lib/permissions';
import {
  Analytics, Broadcast, CollectionState, Hospital, Incident, Message, NotificationItem,
  OfflineQueueItem, Recommendation, ResourceItem, ResourceKey, Role, Team, User,
} from '../lib/types';

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'error' | 'info' | 'warning' | 'critical';
}

const DEFAULT_KEYS = ['incidents', 'teams', 'hospitals', 'resources', 'broadcasts', 'users', 'activity', 'notifications', 'analytics', 'settings'];

const EMPTY_DATA: CollectionState = {
  incidents: [], teams: [], hospitals: [], resources: [], broadcasts: [], users: [],
  activity: [], notifications: [], messages: [], analytics: null, settings: {},
};

const emptyLoading: Record<string, boolean> = Object.fromEntries(DEFAULT_KEYS.map((key) => [key, true]));

function readStoredQueue(): OfflineQueueItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('offgrid_offline_queue') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uid(prefix = 'tmp') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  data: CollectionState;
  loading: Record<string, boolean>;
  toasts: Toast[];
  isOffline: boolean;
  offlineMode: boolean;
  setOfflineMode: (value: boolean) => void;
  queue: OfflineQueueItem[];
  syncing: boolean;
  sseConnected: boolean;
  lastEventAt: string | null;
  online: boolean;
  refresh: (keys?: string[], silent?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  showInactivityWarning: boolean;
  stayLoggedIn: () => void;
  updateProfile: (payload: Record<string, unknown>) => Promise<void>;
  mutate: {
    create: (resource: ResourceKey, payload: Record<string, unknown>) => Promise<any>;
    update: (resource: ResourceKey, id: number | string, payload: Record<string, unknown>) => Promise<any>;
    remove: (resource: ResourceKey, id: number | string) => Promise<void>;
  };
  createIncident: (payload: Record<string, any>) => Promise<Incident | null>;
  sendMessage: (incidentId: number, body: string) => Promise<void>;
  loadMessages: (incidentId: number) => Promise<void>;
  messagesIncidentId: number | null;
  allocate: (incidentId: number, teamId?: number) => Promise<{ team: Recommendation } | null>;
  mergeIncident: (incidentId: number, duplicateOf: number) => Promise<void>;
  setIncidentStatus: (incidentId: number, status: string) => Promise<void>;
  updateIncidentLocation: (incidentId: number, latitude: number, longitude: number) => Promise<void>;
  previewAI: (payload: Record<string, unknown>) => Promise<any | null>;
  simulateSos: () => Promise<void>;
  markNotificationsRead: (all?: boolean, id?: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  setSetting: (key: string, value: string | boolean) => Promise<void>;
  flushQueue: () => Promise<void>;
  removeQueueItem: (id: string) => void;
  openIncidentId: number | null;
  setOpenIncidentId: (id: number | null) => void;
  sosOpen: boolean;
  setSosOpen: (value: boolean) => void;
  globalSearch: string;
  setGlobalSearch: (value: string) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  can: (capability: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<CollectionState>(EMPTY_DATA);
  const [loading, setLoading] = useState<Record<string, boolean>>(emptyLoading);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [offlineMode, setOfflineModeState] = useState(() => localStorage.getItem('offgrid_offline_mode') === 'true');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queue, setQueueState] = useState<OfflineQueueItem[]>(readStoredQueue);
  const [syncing, setSyncing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [openIncidentId, setOpenIncidentId] = useState<number | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [messagesIncidentId, setMessagesIncidentId] = useState<number | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  const dataRef = useRef(data);
  const queueRef = useRef(queue);
  const flushingRef = useRef(false);
  const messagesIncidentRef = useRef<number | null>(null);
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  const inactivityTimer = useRef<number | undefined>(undefined);
  const warningTimer = useRef<number | undefined>(undefined);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { messagesIncidentRef.current = messagesIncidentId; }, [messagesIncidentId]);

  const setQueue = useCallback((updater: (items: OfflineQueueItem[]) => OfflineQueueItem[]) => {
    const next = updater(queueRef.current);
    queueRef.current = next;
    setQueueState(next);
    localStorage.setItem('offgrid_offline_queue', JSON.stringify(next));
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uid('toast');
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 5600);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((item) => item.id !== id)), []);

  const refresh = useCallback(async (keys: string[] = DEFAULT_KEYS, silent = false) => {
    const valid = keys.filter((key) => ENDPOINTS[key]);
    if (!valid.length) return;
    if (!silent) setLoading((prev) => ({ ...prev, ...Object.fromEntries(valid.map((key) => [key, true])) }));
    const results = await Promise.all(valid.map(async (key) => {
      try {
        return [key, await get(ENDPOINTS[key])] as const;
      } catch (error) {
        if (!silent && (error as ApiError).status !== 403) {
          console.warn(`[OFFGRID] Could not refresh ${key}:`, (error as Error).message);
        }
        return [key, null] as const;
      }
    }));
    setData((prev) => {
      const next: any = { ...prev };
      for (const [key, payload] of results) {
        if (!payload) continue;
        if (key === 'analytics') next.analytics = payload.analytics;
        else if (key === 'settings') next.settings = payload.settings;
        else if (key === 'notifications') next.notifications = payload.notifications;
        else if (Array.isArray(payload[key])) next[key] = payload[key];
      }
      return next as CollectionState;
    });
    if (!silent) setLoading((prev) => ({ ...prev, ...Object.fromEntries(valid.map((key) => [key, false])) }));
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    (async () => {
      try {
        const result = await get('/auth/me');
        if (result.user) {
          setUser(result.user);
          await refresh(DEFAULT_KEYS);
        }
      } catch (error) {
        console.warn('[OFFGRID] Session check failed:', (error as Error).message);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const isOffline = offlineMode || !online;

  const setOfflineMode = useCallback((value: boolean) => {
    setOfflineModeState(value);
    localStorage.setItem('offgrid_offline_mode', String(value));
  }, []);

  const loadMessages = useCallback(async (incidentId: number) => {
    setMessagesIncidentId(incidentId);
    messagesIncidentRef.current = incidentId;
    try {
      const result = await get(`/incidents/${incidentId}/messages`);
      setData((prev) => {
        const pending = prev.messages.filter((message) => message.incident_id === incidentId && (message.pendingSync || message._optimistic));
        const deduped = (result.messages as Message[]).filter((message) => !pending.some((p) => p.body === message.body));
        return { ...prev, messages: [...deduped, ...pending] };
      });
    } catch {
      /* incident may have been removed */
    }
  }, []);

  const flushQueue = useCallback(async () => {
    const items = [...queueRef.current];
    if (flushingRef.current || !items.length) return;
    flushingRef.current = true;
    setSyncing(true);
    let synced = 0;
    for (const item of items) {
      try {
        const response = await post(item.endpoint, { ...item.body, offline_synced: true });
        if (item.type === 'incident') {
          const incident = response.incident;
          if (incident) {
            setData((prev) => ({
              ...prev,
              incidents: prev.incidents.map((row) => (String(row.id) === item.tempId ? incident : row)),
            }));
          }
        } else if (item.type === 'message' && item.incidentId) {
          // Drop the placeholder first, then reload the persisted thread if the
          // user is currently viewing that channel.
          setData((prev) => ({ ...prev, messages: prev.messages.filter((message) => String(message.id) !== item.tempId) }));
          if (messagesIncidentRef.current === item.incidentId) await loadMessages(item.incidentId);
        }
        setQueue((current) => current.filter((entry) => entry.id !== item.id));
        synced += 1;
      } catch (error) {
        console.warn('[OFFGRID] Offline sync deferred:', (error as Error).message);
        break;
      }
    }
    setSyncing(false);
    flushingRef.current = false;
    if (synced > 0) {
      pushToast({ title: `${synced} offline ${synced === 1 ? 'report' : 'reports'} synced`, description: 'All queued data is now safely on the server.', tone: 'success' });
      refreshRef.current(['incidents', 'analytics', 'activity', 'notifications'], true);
    }
  }, [loadMessages, pushToast, setQueue]);

  const removeQueueItem = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
    pushToast({ title: 'Queued item removed', tone: 'info' });
  }, [setQueue, pushToast]);

  useEffect(() => {
    if (!isOffline && queue.length > 0) flushQueue();
  }, [isOffline, queue.length, flushQueue]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await post('/auth/login', { email, password });
    setUser(result.user);
    await refresh(DEFAULT_KEYS);
    return result.user as User;
  }, [refresh]);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const result = await post('/auth/register', payload);
    setUser(result.user);
    await refresh(DEFAULT_KEYS);
    return result.user as User;
  }, [refresh]);

  // Setup BroadcastChannel for cross-tab logout sync
  useEffect(() => {
    const channel = new BroadcastChannel('offgrid_auth');
    broadcastChannel.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === 'logout') {
        setUser(null);
        setData(EMPTY_DATA);
        setOpenIncidentId(null);
        setSseConnected(false);
        window.location.href = '/login';
      }
    };
    return () => { channel.close(); };
  }, []);

  const logout = useCallback(async () => {
    try { await post('/auth/logout'); } catch { /* ignore */ }
    // Broadcast to other tabs
    try { broadcastChannel.current?.postMessage({ type: 'logout' }); } catch { /* ignore */ }
    // Clear local storage sensitive items
    localStorage.removeItem('offgrid_offline_queue');
    setUser(null);
    setData(EMPTY_DATA);
    setOpenIncidentId(null);
    setSseConnected(false);
    pushToast({ title: 'You have been signed out', description: 'Your session was securely terminated.', tone: 'success' });
    setTimeout(() => { window.location.href = '/login'; }, 800);
  }, [pushToast]);

  const logoutAll = useCallback(async () => {
    try { await post('/auth/logout-all'); } catch { /* ignore */ }
    try { broadcastChannel.current?.postMessage({ type: 'logout' }); } catch { /* ignore */ }
    localStorage.removeItem('offgrid_offline_queue');
    setUser(null);
    setData(EMPTY_DATA);
    setOpenIncidentId(null);
    setSseConnected(false);
    pushToast({ title: 'Signed out from all devices', description: 'All active sessions have been revoked.', tone: 'success' });
    setTimeout(() => { window.location.href = '/login'; }, 800);
  }, [pushToast]);

  // Inactivity timeout
  const INACTIVITY_WARNING_MS = 14 * 60 * 1000; // 14 min
  const INACTIVITY_LOGOUT_MS = 15 * 60 * 1000;  // 15 min

  const resetInactivityTimer = useCallback(() => {
    window.clearTimeout(inactivityTimer.current);
    window.clearTimeout(warningTimer.current);
    setShowInactivityWarning(false);
    if (!user) return;
    warningTimer.current = window.setTimeout(() => {
      setShowInactivityWarning(true);
    }, INACTIVITY_WARNING_MS);
    inactivityTimer.current = window.setTimeout(() => {
      logout();
    }, INACTIVITY_LOGOUT_MS);
  }, [user, logout]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      window.clearTimeout(inactivityTimer.current);
      window.clearTimeout(warningTimer.current);
      return;
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      window.clearTimeout(inactivityTimer.current);
      window.clearTimeout(warningTimer.current);
    };
  }, [user, resetInactivityTimer]);

  const stayLoggedIn = useCallback(() => {
    setShowInactivityWarning(false);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const updateProfile = useCallback(async (payload: Record<string, unknown>) => {
    const result = await patch('/auth/profile', payload);
    setUser(result.user);
    pushToast({ title: 'Profile updated', tone: 'success' });
  }, [pushToast]);

  const mutateCreate = useCallback(async (resource: ResourceKey, payload: Record<string, unknown>) => {
    const tempId = uid();
    const optimistic = {
      ...payload, id: tempId, _optimistic: true,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, [resource]: [optimistic, ...(prev[resource] as any[])] } as CollectionState));
    try {
      const response = await post(`/${resource}`, payload);
      const item = response[SINGULAR[resource]];
      setData((prev) => ({
        ...prev,
        [resource]: (prev[resource] as any[]).map((row) => (String(row.id) === tempId ? item : row)),
      } as CollectionState));
      pushToast({ title: `${SINGULAR[resource].replace(/^\w/, (c) => c.toUpperCase())} created`, tone: 'success' });
      refreshRef.current(['analytics', 'activity', 'notifications'], true);
      return item;
    } catch (error) {
      setData((prev) => ({
        ...prev,
        [resource]: (prev[resource] as any[]).filter((row) => String(row.id) !== tempId),
      } as CollectionState));
      pushToast({ title: 'Could not create record', description: (error as Error).message, tone: 'error' });
      throw error;
    }
  }, [pushToast]);

  const mutateUpdate = useCallback(async (resource: ResourceKey, id: number | string, payload: Record<string, unknown>) => {
    const snapshot = (dataRef.current[resource] as any[]).find((row) => String(row.id) === String(id));
    setData((prev) => ({
      ...prev,
      [resource]: (prev[resource] as any[]).map((row) => (String(row.id) === String(id) ? { ...row, ...payload, _optimistic: true } : row)),
    } as CollectionState));
    try {
      const response = await patch(`/${resource}/${id}`, payload);
      const item = response[SINGULAR[resource]];
      setData((prev) => ({
        ...prev,
        [resource]: (prev[resource] as any[]).map((row) => (String(row.id) === String(id) ? (item || { ...row, ...payload, _optimistic: false }) : row)),
      } as CollectionState));
      refreshRef.current(['analytics', 'activity'], true);
      return item;
    } catch (error) {
      if (snapshot) {
        setData((prev) => ({
          ...prev,
          [resource]: (prev[resource] as any[]).map((row) => (String(row.id) === String(id) ? snapshot : row)),
        } as CollectionState));
      }
      pushToast({ title: 'Update rolled back', description: (error as Error).message, tone: 'error' });
      throw error;
    }
  }, [pushToast]);

  const mutateRemove = useCallback(async (resource: ResourceKey, id: number | string) => {
    const snapshot = (dataRef.current[resource] as any[]).find((row) => String(row.id) === String(id));
    const index = (dataRef.current[resource] as any[]).findIndex((row) => String(row.id) === String(id));
    setData((prev) => ({
      ...prev,
      [resource]: (prev[resource] as any[]).filter((row) => String(row.id) !== String(id)),
    } as CollectionState));
    try {
      await del(`/${resource}/${id}`);
      pushToast({ title: 'Record deleted', tone: 'success' });
      refreshRef.current(['analytics', 'activity'], true);
    } catch (error) {
      if (snapshot) {
        setData((prev) => {
          const list = [...(prev[resource] as any[])];
          list.splice(Math.max(0, index), 0, snapshot);
          return { ...prev, [resource]: list } as CollectionState;
        });
      }
      pushToast({ title: 'Delete failed', description: (error as Error).message, tone: 'error' });
      throw error;
    }
  }, [pushToast]);

  const buildOfflineIncident = useCallback((payload: Record<string, any>): { incident: Incident; item: OfflineQueueItem } => {
    const tempId = uid('offline');
    const timestamp = new Date().toISOString();
    const incident: Incident = {
      id: tempId,
      code: 'QUEUED-OFFLINE',
      title: payload.title || 'Offline emergency report',
      description: payload.description || '',
      category: payload.category || 'other',
      category_label: 'Awaiting AI classification',
      severity: Number(payload.severity) || 3,
      priority_score: 60,
      status: 'pending',
      source: 'offline',
      reporter_name: user?.name || 'You',
      latitude: Number(payload.latitude) || 13.072,
      longitude: Number(payload.longitude) || 80.251,
      address: payload.address || 'Location captured on device',
      zone: payload.zone || user?.zone || 'Central Chennai',
      people_affected: Number(payload.people_affected) || 0,
      vulnerable_count: Number(payload.vulnerable_count) || 0,
      tags: ['offline', 'pending sync'],
      live_location: Boolean(payload.live_location),
      offline_synced: false,
      sla_minutes: 20,
      created_at: timestamp,
      updated_at: timestamp,
      pendingSync: true,
      _optimistic: true,
    };
    const item: OfflineQueueItem = {
      id: uid('queue'), type: 'incident', endpoint: '/incidents', body: { ...payload, source: 'offline' },
      tempId, createdAt: timestamp, label: incident.title,
    };
    return { incident, item };
  }, [user]);

  const createIncident = useCallback(async (payload: Record<string, any>) => {
    if (isOffline) {
      const { incident, item } = buildOfflineIncident(payload);
      setData((prev) => ({ ...prev, incidents: [incident, ...prev.incidents] }));
      setQueue((current) => [...current, item]);
      pushToast({
        title: 'Report saved offline',
        description: 'GPS position and details are queued on this device and will sync automatically.',
        tone: 'warning',
      });
      return incident;
    }
    const tempId = uid();
    const timestamp = new Date().toISOString();
    const optimistic: Incident = {
      id: tempId, code: 'SENDING…', title: payload.title, description: payload.description,
      category: payload.category || 'other', category_label: 'Classifying…', severity: 3,
      priority_score: 50, status: 'pending', source: payload.source || 'web',
      reporter_name: user?.name, latitude: Number(payload.latitude) || 13.072,
      longitude: Number(payload.longitude) || 80.251, address: payload.address,
      zone: payload.zone || user?.zone, people_affected: Number(payload.people_affected) || 0,
      vulnerable_count: Number(payload.vulnerable_count) || 0, tags: [], live_location: Boolean(payload.live_location),
      created_at: timestamp, updated_at: timestamp, _optimistic: true,
    };
    setData((prev) => ({ ...prev, incidents: [optimistic, ...prev.incidents] }));
    try {
      const response = await post('/incidents', payload);
      const incident = response.incident as Incident;
      setData((prev) => ({ ...prev, incidents: prev.incidents.map((row) => (String(row.id) === tempId ? incident : row)) }));
      const details = [
        `AI: ${response.classification?.categoryLabel} · S${response.classification?.severity}`,
        response.duplicate ? `Possible duplicate of ${response.duplicate.code} flagged` : null,
        incident.assigned_team_id ? 'Rescue team auto-allocated' : null,
      ].filter(Boolean).join(' · ');
      pushToast({ title: 'Emergency report received', description: details, tone: 'success' });
      refreshRef.current(['incidents', 'teams', 'analytics', 'activity', 'notifications'], true);
      return incident;
    } catch (error) {
      if ((error as ApiError).status === 0) {
        setData((prev) => ({ ...prev, incidents: prev.incidents.filter((row) => String(row.id) !== tempId) }));
        const { incident, item } = buildOfflineIncident(payload);
        setData((prev) => ({ ...prev, incidents: [incident, ...prev.incidents] }));
        setQueue((current) => [...current, item]);
        pushToast({ title: 'Connection lost — saved offline', description: 'The report will upload when connectivity returns.', tone: 'warning' });
        return incident;
      }
      setData((prev) => ({ ...prev, incidents: prev.incidents.filter((row) => String(row.id) !== tempId) }));
      pushToast({ title: 'Report could not be submitted', description: (error as Error).message, tone: 'error' });
      throw error;
    }
  }, [buildOfflineIncident, isOffline, pushToast, setQueue, user]);

  const sendMessage = useCallback(async (incidentId: number, body: string) => {
    const tempId = uid('msg');
    const timestamp = new Date().toISOString();
    const message: Message = {
      id: tempId, incident_id: incidentId, author_name: user?.name || 'You', author_role: user?.role,
      body, kind: 'text', created_at: timestamp, _optimistic: true,
      pendingSync: isOffline,
    };
    setData((prev) => ({ ...prev, messages: [...prev.messages, message] }));
    if (isOffline) {
      setQueue((current) => [...current, {
        id: uid('queue'), type: 'message', endpoint: `/incidents/${incidentId}/messages`,
        body: { body }, tempId, incidentId, createdAt: timestamp, label: body.slice(0, 60),
      }]);
      return;
    }
    try {
      const response = await post(`/incidents/${incidentId}/messages`, { body });
      setData((prev) => ({
        ...prev,
        messages: prev.messages.map((row) => (String(row.id) === tempId ? response.message : row)),
      }));
    } catch (error) {
      if ((error as ApiError).status === 0) {
        setQueue((current) => [...current, {
          id: uid('queue'), type: 'message', endpoint: `/incidents/${incidentId}/messages`,
          body: { body }, tempId, incidentId, createdAt: timestamp, label: body.slice(0, 60),
        }]);
        setData((prev) => ({ ...prev, messages: prev.messages.map((row) => (String(row.id) === tempId ? { ...row, pendingSync: true, _optimistic: false } : row)) }));
        return;
      }
      setData((prev) => ({ ...prev, messages: prev.messages.filter((row) => String(row.id) !== tempId) }));
      pushToast({ title: 'Message not sent', description: (error as Error).message, tone: 'error' });
    }
  }, [isOffline, pushToast, setQueue, user]);

  const allocate = useCallback(async (incidentId: number, teamId?: number) => {
    try {
      const response = await post(`/incidents/${incidentId}/allocate`, teamId ? { team_id: teamId } : {});
      setData((prev) => ({ ...prev, incidents: prev.incidents.map((row) => (row.id === incidentId ? response.incident : row)) }));
      pushToast({
        title: `${response.team.code} allocated`,
        description: `AI match ${response.team.score} · ETA ${response.team.etaMinutes} min`,
        tone: 'success',
      });
      refreshRef.current(['incidents', 'teams', 'analytics', 'activity'], true);
      return response;
    } catch (error) {
      pushToast({ title: 'Allocation failed', description: (error as Error).message, tone: 'error' });
      return null;
    }
  }, [pushToast]);

  const mergeIncident = useCallback(async (incidentId: number, duplicateOf: number) => {
    try {
      const response = await post(`/incidents/${incidentId}/merge`, { duplicate_of: duplicateOf });
      setData((prev) => ({ ...prev, incidents: prev.incidents.map((row) => (row.id === incidentId ? response.incident : row)) }));
      pushToast({ title: 'Reports merged', description: 'The duplicate is linked to the primary incident.', tone: 'success' });
      refreshRef.current(['incidents', 'analytics', 'activity'], true);
    } catch (error) {
      pushToast({ title: 'Merge failed', description: (error as Error).message, tone: 'error' });
    }
  }, [pushToast]);

  const setIncidentStatus = useCallback(async (incidentId: number, status: string) => {
    try {
      await mutateUpdate('incidents', incidentId, { status });
      pushToast({ title: 'Status updated', tone: 'success' });
    } catch { /* toast already handled */ }
  }, [mutateUpdate, pushToast]);

  const updateIncidentLocation = useCallback(async (incidentId: number, latitude: number, longitude: number) => {
    try {
      await post(`/incidents/${incidentId}/location`, { latitude, longitude });
    } catch { /* live GPS is best-effort */ }
  }, []);

  const previewAI = useCallback(async (payload: Record<string, unknown>) => {
    if (isOffline) return null;
    try {
      return await post('/ai/classify', payload);
    } catch {
      return null;
    }
  }, [isOffline]);

  const simulateSos = useCallback(async () => {
    try {
      await post('/simulate/sos');
      refreshRef.current(['incidents', 'analytics', 'activity', 'notifications'], true);
    } catch (error) {
      pushToast({ title: 'Simulation failed', description: (error as Error).message, tone: 'error' });
    }
  }, [pushToast]);

  const markNotificationsRead = useCallback(async (all = true, id?: number) => {
    try {
      if (all) await patch('/notifications/read-all');
      else if (id) await patch(`/notifications/${id}/read`);
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((item) => (all || item.id === id ? { ...item, read: true } : item)),
      }));
    } catch { /* ignore */ }
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      await del(`/notifications/${id}`);
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.filter((item) => item.id !== id),
      }));
      pushToast({ title: 'Notification removed', tone: 'info' });
    } catch (error) {
      pushToast({ title: 'Action failed', description: (error as Error).message, tone: 'error' });
    }
  }, [pushToast]);

  const setSetting = useCallback(async (key: string, value: string | boolean) => {
    try {
      const response = await patch('/settings', { [key]: String(value) });
      setData((prev) => ({ ...prev, settings: response.settings }));
      pushToast({ title: 'Setting saved', tone: 'success' });
    } catch (error) {
      pushToast({ title: 'Setting not saved', description: (error as Error).message, tone: 'error' });
    }
  }, [pushToast]);

  /** Server-Sent Events: keep every open dashboard in sync. */
  useEffect(() => {
    if (!user) {
      setSseConnected(false);
      return undefined;
    }
    const source = new EventSource('/api/stream', { withCredentials: true });
    const pending = new Set<string>();
    let timer: number | undefined;
    const schedule = (keys: string[]) => {
      for (const key of keys) pending.add(key);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const keysToRefresh = [...pending];
        pending.clear();
        refreshRef.current(keysToRefresh, true);
      }, 240);
    };
    const parse = (event: MessageEvent) => {
      try { return JSON.parse(event.data).payload || {}; } catch { return {}; }
    };
    const onOpen = () => setSseConnected(true);
    const onSync = (event: MessageEvent) => {
      const { entity } = parse(event);
      setLastEventAt(new Date().toISOString());
      if (entity === 'messages') {
        if (messagesIncidentRef.current) loadMessages(messagesIncidentRef.current);
        return;
      }
      if (!entity || !ENDPOINTS[entity]) return;
      const extra = ['incidents', 'teams', 'hospitals', 'resources'].includes(entity) ? ['analytics', 'activity'] : [];
      schedule([entity, ...extra]);
    };
    const onNotification = (event: MessageEvent) => {
      const payload = parse(event);
      pushToast({
        title: payload.title || 'Notification',
        description: payload.body,
        tone: payload.kind === 'critical' ? 'critical' : payload.kind === 'warning' ? 'warning' : 'info',
      });
      schedule(['notifications']);
    };
    const onMessage = (event: MessageEvent) => {
      const payload = parse(event);
      if (payload.message && payload.incidentId === messagesIncidentRef.current) {
        setData((prev) => {
          if (prev.messages.some((message) => message.id === payload.message.id)) return prev;
          return { ...prev, messages: [...prev.messages, payload.message] };
        });
      }
      setLastEventAt(new Date().toISOString());
    };
    const onTelemetry = (event: MessageEvent) => {
      const payload = parse(event);
      if (!Array.isArray(payload.teams)) return;
      setData((prev) => ({
        ...prev,
        teams: prev.teams.map((team) => {
          const moved = payload.teams.find((entry: any) => entry.id === team.id);
          return moved ? { ...team, latitude: moved.latitude, longitude: moved.longitude } : team;
        }),
      }));
      setLastEventAt(new Date().toISOString());
    };
    const onLocation = (event: MessageEvent) => {
      const payload = parse(event);
      setData((prev) => ({
        ...prev,
        incidents: prev.incidents.map((incident) => (incident.id === payload.incidentId
          ? { ...incident, latitude: payload.latitude, longitude: payload.longitude }
          : incident)),
      }));
    };
    const onSos = (event: MessageEvent) => {
      const payload = parse(event);
      pushToast({
        title: payload.incident?.code ? `Incoming SOS · ${payload.incident.code}` : 'Incoming SOS',
        description: payload.incident?.title,
        tone: 'critical',
      });
      schedule(['incidents', 'analytics', 'activity', 'notifications']);
    };
    const onPresence = () => setLastEventAt(new Date().toISOString());
    const onError = () => setSseConnected(false);

    const onNotificationEvent = (event: MessageEvent) => {
      const payload = parse(event);
      pushToast({
        title: payload.title || 'Emergency Notification',
        description: payload.summary,
        tone: payload.severity >= 5 ? 'critical' : payload.severity >= 4 ? 'warning' : 'info',
      });
      schedule(['notifications']);
    };

    source.onopen = onOpen;
    source.onerror = onError;
    source.addEventListener('sync', onSync as EventListener);
    source.addEventListener('notification', onNotification as EventListener);
    source.addEventListener('notification_event', onNotificationEvent as EventListener);
    source.addEventListener('message', onMessage as EventListener);
    source.addEventListener('telemetry', onTelemetry as EventListener);
    source.addEventListener('location', onLocation as EventListener);
    source.addEventListener('sos', onSos as EventListener);
    source.addEventListener('presence', onPresence as EventListener);
    return () => {
      window.clearTimeout(timer);
      source.removeEventListener('notification_event', onNotificationEvent as EventListener);
      source.close();
    };
  }, [user, loadMessages, pushToast]);

  const can = useCallback((capability: string) => roleCan(user?.role as Role, capability), [user?.role]);

  const value = useMemo<AppContextValue>(() => ({
    user, authLoading, data, loading, toasts, isOffline, offlineMode, setOfflineMode,
    queue, syncing, sseConnected, lastEventAt, online, refresh, login, register, logout, logoutAll,
    showInactivityWarning, stayLoggedIn, updateProfile,
    mutate: { create: mutateCreate, update: mutateUpdate, remove: mutateRemove },
    createIncident, sendMessage, loadMessages, messagesIncidentId,
    allocate, mergeIncident, setIncidentStatus, updateIncidentLocation, previewAI,
    simulateSos, markNotificationsRead, deleteNotification, setSetting, flushQueue, removeQueueItem,
    openIncidentId, setOpenIncidentId, sosOpen, setSosOpen, globalSearch, setGlobalSearch,
    pushToast, dismissToast, can,
  }), [
    user, authLoading, data, loading, toasts, isOffline, offlineMode, setOfflineMode, queue, syncing,
    sseConnected, lastEventAt, online, refresh, login, register, logout, logoutAll,
    showInactivityWarning, stayLoggedIn, updateProfile,
    mutateCreate, mutateUpdate, mutateRemove, createIncident, sendMessage, loadMessages,
    messagesIncidentId, allocate, mergeIncident, setIncidentStatus, updateIncidentLocation,
    previewAI, simulateSos, markNotificationsRead, deleteNotification, setSetting, flushQueue, removeQueueItem,
    openIncidentId, sosOpen, globalSearch, pushToast, dismissToast, can,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
