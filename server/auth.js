import express from 'express';
import { get, run, insert, now } from './db.js';
import { randomToken, verifyPassword, hashPassword, can, ROLES } from './security.js';
import { publish } from './bus.js';

const SESSION_DAYS = 7;

export function publicUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return { ...safe, initials: (safe.name || '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') };
}

export function createSession(userId) {
  const token = randomToken(32);
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  insert('sessions', { token, user_id: userId, created_at: created.toISOString(), expires_at: expires.toISOString() });
  return { token, expires };
}

export function authMiddleware(req, res, next) {
  const token = req.cookies?.offgrid_session;
  if (!token) return next();
  const session = get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) run('DELETE FROM sessions WHERE token = ?', [token]);
    return next();
  }
  const user = get('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (user && user.status === 'active') {
    req.user = publicUser(user);
    req.sessionToken = token;
    run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), user.id]);
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  next();
}

export function requireCapability(capability) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    if (!can(req.user.role, capability)) {
      return res.status(403).json({ error: `Your role (${ROLES[req.user.role]}) does not have permission for this action.` });
    }
    next();
  };
}

export function authRouter() {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = get('SELECT * FROM users WHERE lower(email) = ?', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (user.status !== 'active') return res.status(403).json({ error: 'This account has been suspended.' });
    const { token, expires } = createSession(user.id);
    run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), user.id]);
    res.cookie('offgrid_session', token, {
      httpOnly: true, sameSite: 'lax', path: '/', expires, secure: false,
    });
    publish('presence', { user: publicUser(user), action: 'signed-in' });
    res.json({ user: publicUser(user) });
  });

  router.post('/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');
    const zone = String(req.body?.zone || 'Central Chennai').trim();
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 6) {
      return res.status(400).json({ error: 'Enter a name, a valid email and a password of at least 6 characters.' });
    }
    if (get('SELECT id FROM users WHERE lower(email) = ?', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const id = insert('users', {
      name, email, phone, password_hash: hashPassword(password), role: 'citizen', zone,
      designation: 'Verified Citizen Reporter', status: 'active', avatar_color: '#e9a426',
      created_at: now(), last_active_at: now(),
    });
    const { token, expires } = createSession(id);
    res.cookie('offgrid_session', token, { httpOnly: true, sameSite: 'lax', path: '/', expires });
    const user = publicUser(get('SELECT * FROM users WHERE id = ?', [id]));
    publish('sync', { entity: 'users', action: 'create', id });
    res.status(201).json({ user });
  });

  router.post('/logout', (req, res) => {
    if (req.sessionToken) run('DELETE FROM sessions WHERE token = ?', [req.sessionToken]);
    res.clearCookie('offgrid_session', { path: '/' });
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user || null });
  });

  router.patch('/profile', requireAuth, (req, res) => {
    const allowed = ['name', 'phone', 'zone', 'designation'];
    const changes = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) changes[key] = String(req.body[key]).trim().slice(0, 160);
    }
    if (req.body?.password && String(req.body.password).length >= 6) {
      changes.password_hash = hashPassword(String(req.body.password));
    }
    const entries = Object.entries(changes);
    if (entries.length) {
      run(`UPDATE users SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`, [...entries.map(([, value]) => value), req.user.id]);
    }
    const user = publicUser(get('SELECT * FROM users WHERE id = ?', [req.user.id]));
    publish('sync', { entity: 'users', action: 'update', id: user.id });
    res.json({ user });
  });

  return router;
}
