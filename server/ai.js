/**
 * OFFGRID intelligence engine.
 * Deterministic, explainable scoring used for incident classification, duplicate
 * detection, prioritisation and rescue team allocation. It runs fully on-device
 * (no external AI service or API key required), which is essential for a system
 * that must keep working while connectivity is degraded.
 */

export const CATEGORIES = [
  { key: 'flood', label: 'Flood & Water Rescue', color: '#3b7ff5', teamType: 'Water Rescue', icon: 'Waves' },
  { key: 'medical', label: 'Medical Emergency', color: '#e5484d', teamType: 'Medical Response', icon: 'HeartPulse' },
  { key: 'fire', label: 'Fire & Explosion', color: '#f26430', teamType: 'Fire & Rescue', icon: 'Flame' },
  { key: 'structural', label: 'Structural Collapse', color: '#a263e8', teamType: 'Urban Search & Rescue', icon: 'Building2' },
  { key: 'accident', label: 'Road / Transport Accident', color: '#e9a426', teamType: 'Fire & Rescue', icon: 'CarFront' },
  { key: 'landslide', label: 'Landslide / Terrain', color: '#8a7a5c', teamType: 'Urban Search & Rescue', icon: 'Mountain' },
  { key: 'utility', label: 'Power / Utility Failure', color: '#0f9b8e', teamType: 'Power & Utilities', icon: 'Zap' },
  { key: 'missing', label: 'Missing / Trapped Person', color: '#d9559b', teamType: 'Drone Surveillance', icon: 'Search' },
  { key: 'hazard', label: 'Chemical / Hazard', color: '#6a8f2f', teamType: 'Hazmat', icon: 'Biohazard' },
  { key: 'other', label: 'Other / Unclassified', color: '#7b8798', teamType: 'Evacuation & Relief', icon: 'CircleHelp' },
];

const RULES = [
  {
    category: 'flood', base: 3,
    keywords: ['flood', 'water', 'submerged', 'inundat', 'rain', 'storm', 'drain', 'overflow', 'boat', 'drown', 'river', 'canal', 'cyclone', 'surge', 'tsunami'],
    high: ['drown', 'swept away', 'trapped on rooftop', 'flash flood', 'dam breach'],
    tags: ['water', 'evacuation'], sla: 18,
  },
  {
    category: 'medical', base: 3,
    keywords: ['medical', 'cardiac', 'heart', 'ambulance', 'unconscious', 'injur', 'bleed', 'breath', 'patient', 'hospital', 'pregnan', 'labor', 'stroke', 'seizure', 'oxygen', 'burn victim', 'fracture'],
    high: ['cardiac arrest', 'not breathing', 'unconscious', 'mass casualty', 'critical', 'multiple injured'],
    tags: ['triage', 'ambulance'], sla: 10,
  },
  {
    category: 'fire', base: 4,
    keywords: ['fire', 'smoke', 'blaze', 'burn', 'explosion', 'gas leak', 'short circuit', 'flames', 'electrical fire'],
    high: ['explosion', 'trapped in fire', 'building on fire', 'gas leak', 'multiple floors'],
    tags: ['fire', 'evacuation'], sla: 8,
  },
  {
    category: 'structural', base: 4,
    keywords: ['collapse', 'collapsed', 'building', 'debris', 'rubble', 'crack', 'bridge', 'roof', 'wall', 'under debris', 'structural'],
    high: ['people trapped', 'trapped under', 'multi-storey', 'apartment collapsed'],
    tags: ['usar', 'heavy equipment'], sla: 9,
  },
  {
    category: 'accident', base: 3,
    keywords: ['accident', 'collision', 'vehicle', 'bus', 'truck', 'highway', 'road', 'pileup', 'derail', 'car crash', 'two-wheeler'],
    high: ['multiple vehicles', 'pileup', 'bus', 'fuel spill'],
    tags: ['traffic', 'extrication'], sla: 12,
  },
  {
    category: 'landslide', base: 4,
    keywords: ['landslide', 'mudslide', 'hill', 'slope', 'soil', 'terrain', 'boulder'],
    high: ['houses buried', 'road blocked', 'trapped'],
    tags: ['terrain'], sla: 20,
  },
  {
    category: 'utility', base: 2,
    keywords: ['power', 'electricity', 'outage', 'transformer', 'blackout', 'water supply', 'pipeline', 'grid', 'streetlight', 'pump', 'sewage'],
    high: ['hospital without power', 'substation', 'live wire', 'electrocution'],
    tags: ['infrastructure'], sla: 30,
  },
  {
    category: 'missing', base: 3,
    keywords: ['missing', 'lost', 'trapped', 'stranded', 'not found', 'search', 'last seen', 'sos beacon'],
    high: ['child missing', 'elderly missing', 'trapped inside', 'no contact'],
    tags: ['search'], sla: 15,
  },
  {
    category: 'hazard', base: 4,
    keywords: ['chemical', 'gas', 'toxic', 'leak', 'hazard', 'radiation', 'spill', 'contamination', 'poison'],
    high: ['toxic cloud', 'chemical spill', 'evacuate immediately'],
    tags: ['hazmat', 'evacuation'], sla: 8,
  },
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'is', 'are', 'was', 'were', 'at', 'in', 'on', 'of', 'to', 'for',
  'with', 'from', 'by', 'we', 'our', 'i', 'it', 'this', 'that', 'has', 'have', 'near', 'please',
  'very', 'been', 'there', 'people', 'about', 'after', 'two', 'one', 'three', 'into', 'help',
]);

export function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Classify free-text emergency reports into a category with an explainable score. */
export function classifyIncident(input = {}) {
  const text = `${input.title || ''} ${input.description || ''}`.toLowerCase();
  const tokens = tokenize(text);
  let best = { category: 'other', score: 0, matched: [], high: [], rule: null };

  for (const rule of RULES) {
    const matched = rule.keywords.filter((keyword) => text.includes(keyword) || tokens.includes(keyword));
    const high = rule.high.filter((keyword) => text.includes(keyword));
    const score = matched.length * 2 + high.length * 4 + (matched.length > 1 ? 2 : 0);
    if (score > best.score) best = { category: rule.category, score, matched, high, rule };
  }

  const rule = best.rule;
  const people = Math.max(0, Number(input.people_affected) || 0);
  const vulnerable = Math.max(0, Number(input.vulnerable_count) || 0);
  let severity = rule ? rule.base : 2;
  if (best.high.length) severity += 1;
  if (people >= 10) severity += 1;
  if (people >= 40) severity += 1;
  if (vulnerable >= 3) severity += 1;
  if (/sos|critical|immediate|urgent|life.?threat|dying|severe/.test(text)) severity += 1;
  if (input.source === 'sensor' || input.source === 'sos') severity += 0;
  severity = Math.min(5, Math.max(1, Math.round(severity)));

  const confidence = Math.min(0.98, 0.56 + Math.min(best.score, 14) * 0.03);
  const category = CATEGORIES.find((c) => c.key === best.category) || CATEGORIES.at(-1);
  const reasoning = [];
  if (best.matched.length) reasoning.push(`Matched ${best.matched.slice(0, 3).map((k) => `“${k}”`).join(', ')} in the report`);
  if (best.high.length) reasoning.push(`High-risk phrase detected: “${best.high[0]}”`);
  if (people >= 10) reasoning.push(`${people} people reported affected — severity elevated`);
  if (vulnerable >= 3) reasoning.push(`${vulnerable} vulnerable people (children / elderly / immobile) flagged`);
  if (!rule) reasoning.push('No strong category signal — routed to manual triage');

  return {
    category: category.key,
    categoryLabel: category.label,
    severity,
    confidence: Number(confidence.toFixed(2)),
    suggestedTeamType: category.teamType,
    tags: rule ? [...rule.tags, ...best.high.slice(0, 1)] : ['manual review'],
    slaMinutes: rule ? rule.sla : 25,
    reasoning,
    urgencyLabel: severity >= 5 ? 'CRITICAL' : severity >= 4 ? 'HIGH' : severity >= 3 ? 'MODERATE' : 'LOW',
  };
}

/** Priority score (0–100) used for the live triage queue. */
export function computePriority(incident = {}) {
  const ageMinutes = incident.created_at
    ? Math.max(0, (Date.now() - new Date(incident.created_at).getTime()) / 60000)
    : 0;
  const severity = Number(incident.severity) || 2;
  const people = Math.min(50, Number(incident.people_affected) || 0);
  const vulnerable = Math.min(20, Number(incident.vulnerable_count) || 0);
  const score =
    severity * 13 +
    Math.min(24, people * 0.55) +
    Math.min(13, vulnerable * 1.4) +
    Math.min(10, ageMinutes / 12) +
    (incident.source === 'sos' ? 6 : 0) +
    (incident.live_location ? 3 : 0) -
    (['resolved', 'closed', 'duplicate'].includes(incident.status) ? 60 : 0);
  return Math.max(1, Math.min(100, Math.round(score)));
}

export function distanceKm(a, b) {
  const lat1 = Number(a?.latitude), lng1 = Number(a?.longitude);
  const lat2 = Number(b?.latitude), lng2 = Number(b?.longitude);
  if ([lat1, lng1, lat2, lng2].some((n) => !Number.isFinite(n))) return 999;
  const dLat = (lat2 - lat1) * 111.32;
  const dLng = (lng2 - lng1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function jaccard(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  return intersection / (setA.size + setB.size - intersection);
}

/** Flag likely duplicate reports using text similarity, distance, time and category. */
export function detectDuplicate(candidate, existing = []) {
  let best = null;
  for (const incident of existing) {
    if (incident.id === candidate.id || ['resolved', 'closed', 'duplicate'].includes(incident.status)) continue;
    const distance = distanceKm(candidate, incident);
    const ageMinutes = Math.abs(Date.now() - new Date(incident.created_at).getTime()) / 60000;
    const similarity = jaccard(`${candidate.title} ${candidate.description}`, `${incident.title} ${incident.description}`);
    const sameCategory = incident.category === candidate.category;
    if (distance > 2.2 || ageMinutes > 180 || similarity < 0.16) continue;
    const score = Math.min(
      0.98,
      similarity * 0.52 +
        (1 - Math.min(distance / 2.2, 1)) * 0.24 +
        (1 - Math.min(ageMinutes / 180, 1)) * 0.14 +
        (sameCategory ? 0.1 : 0),
    );
    if (score >= 0.34 && (!best || score > best.score)) {
      best = {
        id: incident.id,
        code: incident.code,
        title: incident.title,
        score: Number(score.toFixed(2)),
        distanceKm: Number(distance.toFixed(2)),
        reasons: [
          `${Math.round(similarity * 100)}% text overlap`,
          `${distance.toFixed(1)} km apart`,
          `${Math.round(ageMinutes)} min apart`,
          ...(sameCategory ? ['same incident category'] : []),
        ],
      };
    }
  }
  return best;
}

/** Rank rescue teams for a given incident using speciality, proximity and capacity. */
export function allocateTeams(incident, teams = []) {
  const classification = classifyIncident(incident);
  return teams
    .filter((team) => team.status !== 'offline')
    .map((team) => {
      const skills = Array.isArray(team.skills) ? team.skills : parseJson(team.skills_json, []);
      const distance = distanceKm(incident, team);
      const specialtyMatch =
        team.type === classification.suggestedTeamType ||
        skills.some((skill) => String(skill).toLowerCase().includes(classification.category));
      const availability = team.status === 'available' ? 1 : team.status === 'standby' ? 0.65 : 0.32;
      const capacity = Math.max(0, 1 - (Number(team.active_incidents) || 0) / Math.max(1, Number(team.capacity) || 4));
      const score =
        (specialtyMatch ? 42 : 8) +
        Math.max(0, 28 - distance * 3.4) +
        availability * 20 +
        capacity * 10 -
        (Number(team.active_incidents) || 0) * 3;
      const reasons = [];
      if (specialtyMatch) reasons.push(`${team.type} matches ${classification.categoryLabel}`);
      else reasons.push('General response capability');
      reasons.push(`${distance.toFixed(1)} km from incident`);
      reasons.push(team.status === 'available' ? 'Currently available' : `Status: ${team.status}`);
      if (capacity < 0.5) reasons.push('High current workload');
      return {
        ...team,
        score: Math.max(1, Math.round(score)),
        distanceKm: Number(distance.toFixed(2)),
        etaMinutes: Math.max(4, Math.round(distance * 3.2 + (team.status === 'available' ? 4 : 9))),
        specialtyMatch,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function parseJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label || 'Other / Unclassified';
}

export function categoryColor(key) {
  return CATEGORIES.find((c) => c.key === key)?.color || '#7b8798';
}

/** Aggregate operational metrics from persisted records. */
export function buildAnalytics({ incidents = [], teams = [], hospitals = [], broadcasts = [], resources = [], messages = [] }) {
  const activeStatuses = ['pending', 'triaged', 'assigned', 'in_progress'];
  const active = incidents.filter((i) => activeStatuses.includes(i.status));
  const resolved = incidents.filter((i) => ['resolved', 'closed'].includes(i.status));
  const minutesBetween = (a, b) => {
    if (!a || !b) return null;
    const value = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const responseTimes = incidents
    .map((i) => minutesBetween(i.created_at, i.acknowledged_at || i.updated_at))
    .filter((n) => n !== null && n < 600);
  const resolutionTimes = resolved
    .map((i) => minutesBetween(i.created_at, i.resolved_at))
    .filter((n) => n !== null && n < 4000);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

  const categoryMap = {};
  for (const incident of incidents) categoryMap[incident.category] = (categoryMap[incident.category] || 0) + 1;
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([key, value]) => ({ key, name: categoryLabel(key), value, color: categoryColor(key) }))
    .sort((a, b) => b.value - a.value);

  const zoneMap = {};
  for (const incident of incidents) {
    const zone = incident.zone || 'Unassigned';
    if (!zoneMap[zone]) zoneMap[zone] = { zone, total: 0, active: 0, critical: 0 };
    zoneMap[zone].total += 1;
    if (activeStatuses.includes(incident.status)) zoneMap[zone].active += 1;
    if (Number(incident.severity) >= 4) zoneMap[zone].critical += 1;
  }

  const severityDistribution = [1, 2, 3, 4, 5].map((level) => ({
    name: `S${level}`,
    value: incidents.filter((i) => Number(i.severity) === level).length,
  }));

  const trend = [];
  for (let day = 13; day >= 0; day -= 1) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day);
    const end = new Date(start.getTime() + 86400000);
    const inRange = (date) => date && new Date(date) >= start && new Date(date) < end;
    trend.push({
      date: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      reported: incidents.filter((i) => inRange(i.created_at)).length,
      resolved: resolved.filter((i) => inRange(i.resolved_at)).length,
      active: incidents.filter((i) => inRange(i.created_at) && activeStatuses.includes(i.status)).length,
    });
  }

  const bedTotal = hospitals.reduce((sum, h) => sum + (Number(h.beds_total) || 0), 0);
  const bedAvailable = hospitals.reduce((sum, h) => sum + (Number(h.beds_available) || 0), 0);
  const icuAvailable = hospitals.reduce((sum, h) => sum + (Number(h.icu_available) || 0), 0);
  const teamUtilisation = teams.length
    ? Math.round((teams.filter((t) => t.status === 'deployed').length / teams.length) * 100)
    : 0;
  const slaCompliant = responseTimes.filter((n) => n <= 20).length;

  return {
    kpis: {
      totalIncidents: incidents.length,
      activeIncidents: active.length,
      criticalIncidents: incidents.filter((i) => Number(i.severity) >= 4 && activeStatuses.includes(i.status)).length,
      resolvedIncidents: resolved.length,
      duplicatesFlagged: incidents.filter((i) => i.duplicate_of).length,
      avgResponseMinutes: avg(responseTimes),
      avgResolutionMinutes: avg(resolutionTimes),
      slaCompliance: responseTimes.length ? Math.round((slaCompliant / responseTimes.length) * 100) : 0,
      peopleAffected: incidents.reduce((sum, i) => sum + (Number(i.people_affected) || 0), 0),
      bedTotal,
      bedAvailable,
      icuAvailable,
      bedOccupancy: bedTotal ? Math.round(((bedTotal - bedAvailable) / bedTotal) * 100) : 0,
      teamUtilisation,
      teamsDeployed: teams.filter((t) => t.status === 'deployed').length,
      broadcastsSent: broadcasts.filter((b) => b.status === 'sent').length,
      lowStockItems: resources.filter((r) => Number(r.quantity) <= Number(r.threshold)).length,
      messagesExchanged: messages.length,
    },
    categoryBreakdown,
    zoneLoad: Object.values(zoneMap).sort((a, b) => b.active - a.active),
    severityDistribution,
    trend,
    teamWorkload: teams.map((team) => ({
      name: team.code || team.name,
      active: Number(team.active_incidents) || 0,
      capacity: Number(team.capacity) || 4,
      status: team.status,
    })),
  };
}
