import { all, get } from '../db.js';

/**
 * Resolves user notification preferences with sensible defaults.
 */
export function getUserPreferences(userId) {
  if (!userId) return null;
  const pref = get('SELECT * FROM notification_preferences WHERE user_id = ?', [userId]);
  if (pref) {
    return {
      email_enabled: Boolean(pref.email_enabled),
      in_app_enabled: Boolean(pref.in_app_enabled),
      sms_enabled: Boolean(pref.sms_enabled),
      preferred_email: pref.preferred_email,
      preferred_phone: pref.preferred_phone,
      notify_assignments: Boolean(pref.notify_assignments),
      notify_status_updates: Boolean(pref.notify_status_updates),
      notify_public_alerts: Boolean(pref.notify_public_alerts),
      notify_team_comms: Boolean(pref.notify_team_comms),
      notify_escalations: Boolean(pref.notify_escalations),
      min_severity: Number(pref.min_severity || 1),
    };
  }
  return {
    email_enabled: true,
    in_app_enabled: true,
    sms_enabled: false,
    preferred_email: null,
    preferred_phone: null,
    notify_assignments: true,
    notify_status_updates: true,
    notify_public_alerts: true,
    notify_team_comms: true,
    notify_escalations: true,
    min_severity: 1,
  };
}

/**
 * Intelligent Recipient Selector.
 * Selects authorized target users based on roles, incident zone, assigned team,
 * event category, and user preferences (with critical emergency override).
 */
export function resolveRecipients(eventType, payload = {}) {
  const incident = payload.incident || {};
  const severity = Number(incident.severity || payload.severity || 2);
  const zone = incident.zone || payload.zone || null;
  const assignedTeamId = incident.assigned_team_id || payload.team?.id || null;
  const reporterId = incident.reporter_id || null;
  const isCriticalEmergency = severity >= 5 || incident.source === 'sos' || eventType === 'sos_activated' || eventType === 'escalation_triggered';

  const recipientMap = new Map(); // userId -> { user, channels: Set<string> }

  function addCandidate(user, channels = ['in_app', 'email']) {
    if (!user || user.status === 'suspended' || user.status === 'inactive') return;
    const pref = getUserPreferences(user.id);

    // Channel filtering according to user preferences (unless critical emergency override applies)
    const effectiveChannels = new Set();
    const effectiveEmail = pref?.preferred_email || user.email;
    const effectivePhone = pref?.preferred_phone || user.phone;

    // Check category preferences
    let categoryAllowed = true;
    if (!isCriticalEmergency && pref) {
      if (eventType.includes('assigned') && !pref.notify_assignments) categoryAllowed = false;
      if (eventType.includes('status') && !pref.notify_status_updates) categoryAllowed = false;
      if (eventType.includes('broadcast') && !pref.notify_public_alerts) categoryAllowed = false;
      if (eventType.includes('escalation') && !pref.notify_escalations) categoryAllowed = false;
      if (severity < pref.min_severity) categoryAllowed = false;
    }

    if (categoryAllowed || isCriticalEmergency) {
      if (channels.includes('in_app') && (isCriticalEmergency || pref.in_app_enabled)) {
        effectiveChannels.add('in_app');
      }
      if (channels.includes('email') && effectiveEmail && (isCriticalEmergency || pref.email_enabled)) {
        effectiveChannels.add('email');
      }
      if (channels.includes('sms') && effectivePhone && (isCriticalEmergency || pref.sms_enabled)) {
        effectiveChannels.add('sms');
      }
    }

    if (effectiveChannels.size > 0) {
      recipientMap.set(user.id, {
        id: user.id,
        name: user.name,
        email: effectiveEmail,
        phone: effectivePhone,
        role: user.role,
        zone: user.zone,
        channels: Array.from(effectiveChannels),
      });
    }
  }

  // --- Scenario 1: Critical SOS Activated ---
  if (eventType === 'sos_activated' || (eventType === 'incident_new' && incident.source === 'sos')) {
    // 1. All Platform Administrators
    const admins = all("SELECT * FROM users WHERE role = 'admin' AND status = 'active'");
    admins.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));

    // 2. Authorities in this zone (or Central authorities)
    const authorities = all(
      "SELECT * FROM users WHERE role = 'authority' AND status = 'active' AND (zone = ? OR zone = 'Central Chennai')",
      [zone],
    );
    authorities.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));

    // 3. Responders in assigned team (or responders in that zone)
    if (assignedTeamId) {
      const teamResponders = all('SELECT * FROM users WHERE team_id = ? AND status = \'active\'', [assignedTeamId]);
      teamResponders.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));
    } else {
      const zoneResponders = all("SELECT * FROM users WHERE role = 'responder' AND zone = ? AND status = 'active' LIMIT 6", [zone]);
      zoneResponders.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }

    // 4. Medical / Hospital coordinators if medical trauma
    if (incident.category === 'medical' || incident.category === 'trauma') {
      const medCoordinators = all("SELECT * FROM users WHERE role IN ('hospital', 'medical') AND status = 'active' LIMIT 4");
      medCoordinators.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }
  }

  // --- Scenario 2: Emergency Escalation ---
  else if (eventType === 'escalation_triggered') {
    const stage = payload.stage || 1;
    if (stage === 1) {
      // Stage 1: Team lead and team responders
      if (assignedTeamId) {
        const teamMembers = all('SELECT * FROM users WHERE team_id = ? AND status = \'active\'', [assignedTeamId]);
        teamMembers.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));
      } else {
        const zoneResponders = all("SELECT * FROM users WHERE role = 'responder' AND zone = ? AND status = 'active' LIMIT 4", [zone]);
        zoneResponders.forEach((u) => addCandidate(u, ['in_app', 'email']));
      }
    } else if (stage === 2) {
      // Stage 2: Regional coordinators & Authorities in zone
      const authorities = all("SELECT * FROM users WHERE role = 'authority' AND status = 'active' AND (zone = ? OR zone = 'Central Chennai')", [zone]);
      authorities.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));
    } else if (stage >= 3) {
      // Stage 3 & 4: Platform Admins + High Command
      const highCommand = all("SELECT * FROM users WHERE role IN ('admin', 'authority') AND status = 'active'");
      highCommand.forEach((u) => addCandidate(u, ['in_app', 'email', 'sms']));
    }
  }

  // --- Scenario 3: Team Assignment / Reassignment ---
  else if (eventType === 'team_assigned' || eventType === 'team_reassigned') {
    if (assignedTeamId) {
      const teamUsers = all('SELECT * FROM users WHERE team_id = ? AND status = \'active\'', [assignedTeamId]);
      teamUsers.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }
    // Also notify authorities in zone
    const zoneAuthorities = all("SELECT * FROM users WHERE role = 'authority' AND zone = ? AND status = 'active'", [zone]);
    zoneAuthorities.forEach((u) => addCandidate(u, ['in_app']));

    // Notify incident reporter if citizen
    if (reporterId) {
      const reporter = get('SELECT * FROM users WHERE id = ?', [reporterId]);
      if (reporter) addCandidate(reporter, ['in_app', 'email']);
    }
  }

  // --- Scenario 4: Incident Status / Resolved ---
  else if (eventType === 'status_changed' || eventType === 'incident_resolved') {
    if (reporterId) {
      const reporter = get('SELECT * FROM users WHERE id = ?', [reporterId]);
      if (reporter) addCandidate(reporter, ['in_app', 'email']);
    }
    if (assignedTeamId) {
      const teamUsers = all('SELECT * FROM users WHERE team_id = ? AND status = \'active\'', [assignedTeamId]);
      teamUsers.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }
    const zoneAuthorities = all("SELECT * FROM users WHERE role = 'authority' AND zone = ? AND status = 'active'", [zone]);
    zoneAuthorities.forEach((u) => addCandidate(u, ['in_app']));
  }

  // --- Scenario 5: Public Emergency Broadcast ---
  else if (eventType === 'broadcast_published') {
    const broadcast = payload.broadcast || {};
    const targetZones = Array.isArray(broadcast.zones) && broadcast.zones.length > 0 ? broadcast.zones : null;

    let targetUsers = [];
    if (!targetZones || targetZones.includes('All Zones')) {
      targetUsers = all("SELECT * FROM users WHERE status = 'active'");
    } else {
      const placeholders = targetZones.map(() => '?').join(', ');
      targetUsers = all(`SELECT * FROM users WHERE status = 'active' AND zone IN (${placeholders})`, targetZones);
    }

    const broadcastChannels = Array.isArray(broadcast.channels) ? broadcast.channels : ['in_app', 'email'];
    targetUsers.forEach((u) => addCandidate(u, broadcastChannels));
  }

  // --- Scenario 6: General New Incident ---
  else {
    // Zone authorities
    const authorities = all(
      "SELECT * FROM users WHERE role = 'authority' AND status = 'active' AND (zone = ? OR zone = 'Central Chennai')",
      [zone],
    );
    authorities.forEach((u) => addCandidate(u, ['in_app', severity >= 4 ? 'email' : 'in_app']));

    // Admins for high severity
    if (severity >= 4) {
      const admins = all("SELECT * FROM users WHERE role = 'admin' AND status = 'active'");
      admins.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }

    if (assignedTeamId) {
      const teamUsers = all('SELECT * FROM users WHERE team_id = ? AND status = \'active\'', [assignedTeamId]);
      teamUsers.forEach((u) => addCandidate(u, ['in_app', 'email']));
    }
  }

  return Array.from(recipientMap.values());
}

