# OFFGRID — Emergency Response Network

A full-stack, offline-capable emergency coordination platform for **citizens, emergency responders, disaster management authorities, hospitals, medical teams and platform administrators**.

OFFGRID turns an incoming SOS into a classified, de-duplicated, prioritised and allocated incident — then keeps every participant in sync in real time.

---

## What is included

| Area | Capability |
| --- | --- |
| Smart SOS | One-tap SOS, browser GPS capture, live location streaming, offline queue, instant AI assessment |
| AI incident classification | Explainable on-device rule engine: category, severity, confidence, reasoning, tags, SLA |
| Duplicate detection | Text similarity + geographic distance + time window + category matching, with merge flow |
| Emergency prioritisation | 0–100 score from severity, people affected, vulnerable people, age, source and live GPS |
| Intelligent allocation | Rescue teams ranked by speciality, proximity, availability, capacity and workload |
| Real-time communication | Server-Sent Events, per-incident chat channels, system notifications, live team telemetry |
| Live tracking | Stylised offline map with incident/team/hospital markers and streaming position updates |
| Emergency analytics | Response/resolution times, SLA compliance, category/zone/severity breakdowns, 14-day trends, CSV export |
| Full CRUD | Incidents, rescue teams, hospitals, resources, broadcasts and users — create, read, update, delete |
| Auth & RBAC | Six roles, scrypt password hashing, HTTP-only sessions, server-side capability checks |
| Persistence | SQLite (`node:sqlite`, zero native dependencies) with automatic realistic demo seeding |
| Offline | Service worker app shell, localStorage report queue, automatic background sync, manual offline mode |
| UX | Dashboard sidebar, empty/loading/optimistic states, toasts, responsive layout, PWA manifest |

---

## Quick start (development)

Requires **Node.js 22.5+** (for built-in SQLite).

```bash
npm install
npm run dev
```

- Frontend (Vite): `http://localhost:5173`
- API: `http://localhost:3001` (proxied through Vite under `/api`)

Other scripts:

```bash
npm run typecheck     # TypeScript checks
npm run build         # production frontend build into dist/
npm run export:app    # standalone app folder + distributable ZIP
npm start             # single process: API + built frontend on PORT (default 3001)
```

### Production single-server

```bash
npm install
npm run build
PORT=3000 npm start
```

The Express server serves `dist/` and all `/api/*` routes from one origin.

### Standalone app export

Regenerate the export at any time with:

```bash
npm run export:app
```

That command builds the frontend, bundles the server into a single `offgrid.cjs`, creates `dist-app/` (standalone app folder) and `OFFGRID-app.zip` (distributable archive). Then:

```bash
unzip OFFGRID-app.zip
cd OFFGRID-app
./start.sh                 # or: PORT=3000 node offgrid.cjs
```

It contains the bundled Node server, the built React app, the PWA assets and a `data/` folder. On first launch it creates `data/offgrid.db` and seeds the full demo dataset automatically. No `npm install` is required.

---

## Demo accounts

All demo accounts use the password **`Demo@123`**. The sign-in screen also has one-click role cards.

| Role | Email | What you can do |
| --- | --- | --- |
| Platform Administrator | `admin@offgrid.in` | Everything, including users & access and settings |
| Disaster Authority | `authority@offgrid.in` | Command centre, triage, allocation, teams, broadcasts, analytics |
| Emergency Responder | `responder@offgrid.in` | Field missions, status updates, team and map views |
| Hospital Coordinator | `hospital@offgrid.in` | Bed/ICU/oxygen capacity, inbound patient flow |
| Medical Team | `medical@offgrid.in` | Triage, medical channels, hospital capacity |
| Citizen | `citizen@offgrid.in` | Smart SOS, offline reports, own incidents, public alerts |

---

## Architecture

```
src/                     React 18 + TypeScript + Vite frontend
  context/AppContext.tsx  Auth, collections, SSE, optimistic CRUD, offline queue, toasts
  components/             UI kit, sidebar/topbar, SOS modal, incident drawer, map, CRUD manager
  pages/                  Command centre, incidents, map, comms, teams, hospitals,
                          resources, broadcasts, analytics, users, settings, login
  lib/                    API client, types, formatters, permissions, geo projection
  styles.css              Complete design system (responsive, dark command palette)
server/
  index.js                Express app, API mount, static hosting, telemetry loop
  db.js                   SQLite schema + persistence helpers + activity log
  seed.js                 24 users, 10 teams, 7 hospitals, 31 incidents, messages, alerts
  ai.js                   Classification, duplicates, priority, allocation, analytics
  security.js             Password hashing, sessions, role capabilities
  routes/                 Auth, incidents, generic CRUD, analytics, SSE, simulation
public/
  sw.js                   Offline app shell (network-first, never caches /api)
  manifest.webmanifest    Installable PWA with SOS / incidents / map shortcuts
  icon.svg                App icon
```

### Data flow

1. A report arrives via the SOS dialog (or the offline queue / simulated beacon).
2. `classifyIncident()` derives category, severity, confidence and human-readable reasoning.
3. `detectDuplicate()` compares open reports using token overlap, distance, time and category.
4. `computePriority()` produces the triage score; critical SOS reports are auto-allocated.
5. `allocateTeams()` ranks units; `syncTeamLoads()` keeps deployment counters honest.
6. `publish()` broadcasts a Server-Sent Event; every open dashboard refreshes silently.
7. All mutations are persisted to SQLite and reflected in analytics immediately.

### Real-time & offline

- `/api/stream` is an SSE endpoint with heartbeats. Event types: `sync`, `message`, `notification`, `telemetry`, `location`, `sos`, `presence`.
- Deployed teams emit position updates every 9 seconds while `simulate_live` is enabled.
- With **force offline mode** on (sidebar or Settings), new reports and channel messages are queued in `localStorage`, shown with a `Queued offline` state, and uploaded automatically when connectivity returns.
- The service worker caches the app shell network-first; API traffic is never cached.

---

## API summary

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` | Sessions |
| `GET/PATCH` | `/api/auth/me`, `/api/auth/profile` | Current user & profile |
| `GET/POST` | `/api/incidents` | List (filters) / create with AI triage |
| `GET/PATCH/DELETE` | `/api/incidents/:id` | Incident CRUD |
| `GET/POST` | `/api/incidents/:id/messages` | Incident channel |
| `GET` | `/api/incidents/:id/recommendations` | Ranked teams |
| `POST` | `/api/incidents/:id/allocate`, `/merge`, `/location` | Dispatch, duplicate merge, GPS pin |
| `POST` | `/api/ai/classify` | Live AI preview (category, priority, duplicates, teams) |
| `CRUD` | `/api/teams`, `/api/hospitals`, `/api/resources`, `/api/broadcasts`, `/api/users` | Core resources |
| `GET` | `/api/analytics`, `/api/activity`, `/api/notifications`, `/api/settings` | Dashboards |
| `GET` | `/api/stream` | Server-Sent Events |
| `POST` | `/api/simulate/sos` | Demo incoming SOS |
| `GET` | `/api/export/incidents.csv` | CSV export |

All write routes enforce role capabilities on the server.

---

## PWA installation

Open the app in Chrome/Edge and use **Install app** from the address bar (or Add to Home Screen on mobile). The manifest provides standalone display, theme colours, an app icon and shortcuts for **Send SOS**, **Incident register** and **Live map**.

## Resetting demo data

Stop the server and delete `data/offgrid.db*` — the next start reseeds the complete demo dataset.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | API / production server port |
| `OFFGRID_ROOT` | `process.cwd()` | Root used to locate `dist/` and `data/` |
