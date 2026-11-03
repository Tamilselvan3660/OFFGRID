import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { all, get, run, now } from './db.js';
import { authMiddleware, authRouter, requireAuth } from './auth.js';
import { incidentsRouter, aiRouter } from './routes/incidents.js';
import { collectionRouter } from './routes/collections.js';
import { miscRouter, streamHandler } from './routes/misc.js';
import { publish } from './bus.js';

const root = path.resolve(process.env.OFFGRID_ROOT || process.cwd());
const app = express();
const PORT = Number(process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(authMiddleware);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational', service: 'OFFGRID Emergency Network',
    time: now(), version: '1.0.0',
    database: 'SQLite (persistent)',
    incidents: get('SELECT COUNT(*) AS count FROM incidents').count,
    user: req.user?.name || null,
  });
});

app.use('/api/auth', authRouter());
app.use('/api/incidents', incidentsRouter());
app.use('/api/ai', aiRouter());
for (const table of ['teams', 'hospitals', 'resources', 'broadcasts', 'users']) {
  app.use(`/api/${table}`, collectionRouter(table));
}
app.use('/api', miscRouter());
app.get('/api/stream', requireAuth, streamHandler);

app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.path}` }));
app.use((error, req, res, next) => {
  console.error('[OFFGRID API ERROR]', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: error?.message || 'Unexpected server error.' });
});

// In production the same process serves the built React application.
const dist = path.join(root, 'dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { maxAge: '1h' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

/** Live telemetry: deployed teams move toward their highest-priority incident. */
const telemetry = setInterval(() => {
  try {
    if (get("SELECT value FROM settings WHERE key = 'simulate_live'")?.value === 'false') return;
    const teams = all("SELECT id, latitude, longitude FROM teams WHERE status = 'deployed'");
    const moved = [];
    for (const team of teams) {
      const target = get(
        "SELECT latitude, longitude FROM incidents WHERE assigned_team_id = ? AND status IN ('assigned','in_progress') ORDER BY priority_score DESC LIMIT 1",
        [team.id],
      );
      if (!target || !Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) continue;
      const dLat = target.latitude - team.latitude;
      const dLng = target.longitude - team.longitude;
      const length = Math.hypot(dLat, dLng);
      if (length < 0.0004) continue;
      const step = Math.min(0.00055, length * 0.18);
      const latitude = Number((team.latitude + (dLat / length) * step).toFixed(6));
      const longitude = Number((team.longitude + (dLng / length) * step).toFixed(6));
      run('UPDATE teams SET latitude = ?, longitude = ? WHERE id = ?', [latitude, longitude, team.id]);
      moved.push({ id: team.id, latitude, longitude });
    }
    if (moved.length) publish('telemetry', { teams: moved, at: now() });
  } catch (error) {
    console.error('[OFFGRID telemetry]', error.message);
  }
}, 9000);
telemetry.unref?.();

const cleanup = setInterval(() => {
  try {
    run('DELETE FROM sessions WHERE expires_at < ?', [now()]);
  } catch { /* no-op */ }
}, 3600000);
cleanup.unref?.();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[OFFGRID] API running on http://0.0.0.0:${PORT} (${fs.existsSync(path.join(dist, 'index.html')) ? 'API + built web app' : 'API only'})`);
});
