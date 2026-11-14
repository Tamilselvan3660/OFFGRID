import express from 'express';
import { get, run, insert, all, now } from './db.js';
import { randomToken, verifyPassword, hashPassword, can, ROLES } from './security.js';
import { publish } from './bus.js';

const SESSION_DAYS = 7;

export function publicUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return { ...safe, initials: (safe.name || '').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') };
}

function getDeviceInfo(req) {
  return req.headers['user-agent']?.slice(0, 200) || 'Unknown';
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim().slice(0, 64);
}

export function createSession(userId, req = null) {
  const token = randomToken(32);
  const created = new Date();
  const expires = new Date(created.getTime() + SESSION_DAYS * 86400000);
  insert('sessions', {
    token,
    user_id: userId,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    device_info: req ? getDeviceInfo(req) : null,
    ip_address: req ? getIp(req) : null,
    last_activity_at: created.toISOString(),
  });
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
    req.sessionId = session.token;
    const nowTs = now();
    run('UPDATE users SET last_active_at = ? WHERE id = ?', [nowTs, user.id]);
    run('UPDATE sessions SET last_activity_at = ? WHERE token = ?', [nowTs, token]);
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

function recordLoginActivity(userId, userEmail, success, req, sessionToken = null, failureReason = null) {
  try {
    insert('login_activity', {
      user_id: userId || null,
      user_email: userEmail || null,
      success: success ? 1 : 0,
      ip_address: getIp(req),
      device_info: getDeviceInfo(req),
      timestamp: now(),
      session_token: sessionToken ? sessionToken.slice(0, 16) + '…' : null,
      failure_reason: failureReason,
    });
  } catch { /* non-fatal */ }
}

function checkSuspiciousLogin(email, req) {
  try {
    const ip = getIp(req);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recentFailures = get(
      "SELECT COUNT(*) AS count FROM login_activity WHERE ip_address = ? AND success = 0 AND timestamp > ?",
      [ip, tenMinutesAgo]
    );
    if (recentFailures?.count >= 5) {
      const recentAlert = get(
        "SELECT id FROM security_audit_logs WHERE ip_address = ? AND event_type = 'suspicious_login' AND created_at > ?",
        [ip, tenMinutesAgo]
      );
      if (!recentAlert) {
        insert('security_audit_logs', {
          user_id: null,
          event_type: 'suspicious_login',
          details: JSON.stringify({ email, ip, failures: recentFailures.count }),
          ip_address: ip,
          created_at: now(),
        });
      }
    }
  } catch { /* non-fatal */ }
}

export function authRouter() {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = get('SELECT * FROM users WHERE lower(email) = ?', [email]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      checkSuspiciousLogin(email, req);
      recordLoginActivity(user?.id || null, email, false, req, null, 'Invalid credentials');
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (user.status !== 'active') {
      recordLoginActivity(user.id, email, false, req, null, 'Account suspended');
      return res.status(403).json({ error: 'This account has been suspended.' });
    }
    const { token, expires } = createSession(user.id, req);
    run('UPDATE users SET last_active_at = ? WHERE id = ?', [now(), user.id]);
    recordLoginActivity(user.id, email, true, req, token);
    res.cookie('offgrid_session', token, {
      httpOnly: true, sameSite: 'strict', path: '/', expires, secure: false,
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
    const { token, expires } = createSession(id, req);
    recordLoginActivity(id, email, true, req, token);
    res.cookie('offgrid_session', token, { httpOnly: true, sameSite: 'strict', path: '/', expires });
    const user = publicUser(get('SELECT * FROM users WHERE id = ?', [id]));
    publish('sync', { entity: 'users', action: 'create', id });
    res.status(201).json({ user });
  });

  router.post('/logout', (req, res) => {
    if (req.sessionToken) {
      try {
        insert('security_audit_logs', {
          user_id: req.user?.id || null,
          event_type: 'logout',
          details: JSON.stringify({ session_prefix: req.sessionToken.slice(0, 8) }),
          ip_address: getIp(req),
          created_at: now(),
        });
      } catch { /* non-fatal */ }
      run('DELETE FROM sessions WHERE token = ?', [req.sessionToken]);
    }
    res.clearCookie('offgrid_session', { path: '/' });
    res.json({ ok: true });
  });

  router.post('/logout-all', requireAuth, (req, res) => {
    try {
      const count = get('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?', [req.user.id]);
      run('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
      insert('security_audit_logs', {
        user_id: req.user.id,
        event_type: 'logout_all',
        details: JSON.stringify({ sessions_revoked: count?.count || 0 }),
        ip_address: getIp(req),
        created_at: now(),
      });
    } catch { /* non-fatal */ }
    res.clearCookie('offgrid_session', { path: '/' });
    res.json({ ok: true, message: 'All sessions have been terminated.' });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user || null });
  });

  router.get('/sessions', requireAuth, (req, res) => {
    const sessions = all(
      'SELECT token, created_at, expires_at, device_info, ip_address, last_activity_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    ).map((s) => ({
      ...s,
      token: s.token.slice(0, 8) + '…',
      is_current: s.token === req.sessionToken,
    }));
    res.json({ sessions });
  });

  router.delete('/sessions/:token', requireAuth, (req, res) => {
    const prefix = String(req.params.token || '');
    const session = get('SELECT * FROM sessions WHERE token LIKE ? AND user_id = ?', [prefix.replace('…', '') + '%', req.user.id]);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    run('DELETE FROM sessions WHERE token = ?', [session.token]);
    if (session.token === req.sessionToken) res.clearCookie('offgrid_session', { path: '/' });
    res.json({ ok: true });
  });

  router.get('/login-activity', requireAuth, (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (filter === 'success') { where += ' AND success = 1'; }
    else if (filter === 'failed') { where += ' AND success = 0'; }

    const total = get(`SELECT COUNT(*) AS count FROM login_activity ${where}`, params);
    const rows = all(
      `SELECT id, success, ip_address, device_info, timestamp, failure_reason FROM login_activity ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({ activity: rows, total: total?.count || 0, page, pages: Math.ceil((total?.count || 0) / limit) });
  });

  router.get('/security-audit', requireCapability('settings:manage'), (req, res) => {
    const rows = all('SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json({ logs: rows });
  });

  router.get('/admin/sessions', requireCapability('settings:manage'), (req, res) => {
    const sessions = all(`
      SELECT s.token, s.user_id, s.created_at, s.expires_at, s.device_info, s.ip_address, s.last_activity_at,
             u.name as user_name, u.email as user_email, u.role as user_role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 100
    `).map((s) => ({ ...s, token: s.token.slice(0, 8) + '…' }));
    res.json({ sessions });
  });

  router.delete('/admin/sessions/:userId', requireCapability('settings:manage'), (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });
    const count = get('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?', [userId]);
    run('DELETE FROM sessions WHERE user_id = ?', [userId]);
    insert('security_audit_logs', {
      user_id: req.user.id,
      event_type: 'admin_session_revoke',
      details: JSON.stringify({ target_user_id: userId, sessions_revoked: count?.count || 0 }),
      ip_address: getIp(req),
      created_at: now(),
    });
    res.json({ ok: true, revoked: count?.count || 0 });
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
