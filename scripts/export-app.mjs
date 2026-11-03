/**
 * Build a zero-install, production-ready OFFGRID app.
 *
 * Output:
 *   dist-app/          standalone folder (bundled Node server + built web app)
 *   OFFGRID-app.zip    distributable archive of that folder
 *
 * The bundle has no dependency on node_modules: Express, the API routes and the
 * SQLite/AI engine are bundled into offgrid.cjs; Node's built-in sqlite is used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const appDir = path.join(root, 'dist-app');
const zipPath = path.join(root, 'OFFGRID-app.zip');

function run(command, cwd = root) {
  console.log(`\n› ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

run('npm run build');

console.log('\n› preparing dist-app/');
fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(path.join(appDir, 'data'), { recursive: true });
fs.cpSync(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true });

run('npx esbuild server/index.js --bundle --platform=node --format=cjs --target=node22 --minify --legal-comments=none --external:node:sqlite --outfile=dist-app/offgrid.cjs');

const startScript = `#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export PORT="\${PORT:-3000}"
export NODE_OPTIONS="--disable-warning=ExperimentalWarning \${NODE_OPTIONS:-}"
echo "OFFGRID — Emergency Response Network"
echo "Open http://localhost:$PORT"
echo "Demo login: admin@offgrid.in / Demo@123"
exec node offgrid.cjs
`;
fs.writeFileSync(path.join(appDir, 'start.sh'), startScript);
fs.chmodSync(path.join(appDir, 'start.sh'), 0o755);

fs.writeFileSync(path.join(appDir, 'package.json'), `${JSON.stringify({
  name: 'offgrid-standalone-app',
  version: '1.0.0',
  private: true,
  description: 'OFFGRID standalone emergency response app — no install required',
  scripts: { start: 'node offgrid.cjs' },
  engines: { node: '>=22.5' },
}, null, 2)}\n`);

fs.writeFileSync(path.join(appDir, 'data', '.gitkeep'), '');

const exportReadme = [
  '# OFFGRID — standalone app',
  '',
  'A complete, production build of OFFGRID in one folder. No `npm install` is required.',
  '',
  '## Run',
  '',
  '```bash',
  './start.sh',
  '# or',
  'PORT=3000 node offgrid.cjs',
  '```',
  '',
  'Then open **http://localhost:3000** (or the port you set).',
  '',
  'Node.js **22.5+** is required because the app uses the built-in `node:sqlite` module.',
  '',
  '## First launch',
  '',
  'The server creates `data/offgrid.db` and seeds a realistic demo dataset:',
  '24 users, 10 rescue teams, 7 hospitals, 31 incidents, coordination messages,',
  'broadcasts, resources and activity history. Delete `data/offgrid.db*` to reset.',
  '',
  '## Demo accounts',
  '',
  'Password for every account: **Demo@123**',
  '',
  '| Role | Email |',
  '| --- | --- |',
  '| Platform Administrator | admin@offgrid.in |',
  '| Disaster Authority | authority@offgrid.in |',
  '| Emergency Responder | responder@offgrid.in |',
  '| Hospital Coordinator | hospital@offgrid.in |',
  '| Medical Team | medical@offgrid.in |',
  '| Citizen | citizen@offgrid.in |',
  '',
  '## Install as an app',
  '',
  'The bundle includes `manifest.webmanifest`, `icon.svg` and a service worker.',
  'Open it in Chrome/Edge and choose **Install app**, or use Add to Home Screen on mobile.',
  'The SOS, Incidents and Map shortcuts are available from the app icon.',
  '',
  '## What is inside',
  '',
  '- `offgrid.cjs` — bundled Express API, AI engine, SSE stream, SQLite persistence',
  '- `dist/` — built React dashboard, fonts, PWA assets',
  '- `data/` — persistent SQLite database (created on first run)',
  '- `start.sh` — one-command launcher',
  '',
].join('\n');
fs.writeFileSync(path.join(appDir, 'README.md'), exportReadme);

// Never ship a stale/test database; the app seeds fresh demo data on first run.
for (const file of fs.readdirSync(path.join(appDir, 'data'))) {
  if (file.startsWith('offgrid.db')) fs.rmSync(path.join(appDir, 'data', file), { force: true });
}

fs.rmSync(zipPath, { force: true });
run('zip -qr ../OFFGRID-app.zip .', appDir);

const size = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`\n✓ Exported dist-app/ and OFFGRID-app.zip (${size} MB)`);
console.log('  Run it with: cd dist-app && ./start.sh');
