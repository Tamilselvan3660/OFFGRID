/**
 * Professional responsive HTML email templates using OFFGRID Design System:
 * Primary Navy: #101D2B
 * Primary Orange: #F45B24
 * Warm White / Background: #FFF7F0
 * White Card Surface: #FFFFFF
 * Critical Red: #E5484D
 * Warning Amber: #E9A426
 * Success Green: #10B981
 */

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSeverityColor(severity = 2, status = '') {
  if (status === 'resolved' || status === 'closed') return '#10B981';
  if (severity >= 5) return '#E5484D';
  if (severity >= 4) return '#F45B24';
  if (severity >= 3) return '#E9A426';
  return '#10B981';
}

function getSeverityLabel(severity = 2, status = '') {
  if (status === 'resolved' || status === 'closed') return 'RESOLVED';
  if (severity >= 5) return 'CRITICAL (S5)';
  if (severity >= 4) return 'HIGH (S4)';
  if (severity >= 3) return 'MEDIUM (S3)';
  if (severity >= 2) return 'LOW (S2)';
  return 'MINIMAL (S1)';
}

function getPriorityLabel(priority = 'normal') {
  switch (String(priority).toLowerCase()) {
    case 'immediate':
    case 'critical':
      return 'IMMEDIATE DISPATCH';
    case 'high':
      return 'HIGH PRIORITY';
    case 'low':
      return 'ROUTINE';
    default:
      return 'NORMAL PRIORITY';
  }
}

/**
 * Base email layout wrapper ensuring consistent responsive typography and styling.
 */
function renderBaseLayout({
  bannerTitle,
  bannerColor,
  incidentCode,
  title,
  description,
  severity = 2,
  priority = 'normal',
  status = 'pending',
  zone = 'Central Chennai',
  address = '',
  teamName = null,
  peopleAffected = 0,
  timestamp,
  actionUrl = 'http://localhost:5173/incidents',
  actionLabel = 'Open in Command Center',
  extraSectionHtml = '',
}) {
  const sevColor = getSeverityColor(severity, status);
  const sevLabel = getSeverityLabel(severity, status);
  const priLabel = getPriorityLabel(priority);
  const displayTime = timestamp ? new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('en-IN');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #FFF7F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #101D2B; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E5DFD7; box-shadow: 0 4px 16px rgba(16, 29, 43, 0.06); }
    .header { background-color: #101D2B; padding: 22px 28px; text-align: left; }
    .header-logo { font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px; text-decoration: none; }
    .header-logo span { color: #F45B24; }
    .header-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #8F9EAF; margin-top: 4px; }
    .banner { background-color: ${bannerColor}; color: #FFFFFF; padding: 12px 28px; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 28px; }
    .incident-ref { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; color: #64748B; font-weight: 600; margin-bottom: 6px; }
    .incident-title { font-size: 22px; font-weight: 700; color: #101D2B; margin: 0 0 16px 0; line-height: 1.3; }
    .description-box { background-color: #F8FAFC; border-left: 4px solid #F45B24; padding: 14px 18px; border-radius: 0 6px 6px 0; font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .meta-table { width: 100%; margin-bottom: 24px; }
    .meta-cell { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
    .meta-label { color: #64748B; font-weight: 600; width: 35%; }
    .meta-value { color: #101D2B; font-weight: 600; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; }
    .btn-action { display: inline-block; background-color: #F45B24; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 6px; text-align: center; margin-top: 10px; }
    .footer { background-color: #F8FAFC; border-top: 1px solid #E5DFD7; padding: 20px 28px; font-size: 12px; color: #64748B; line-height: 1.5; }
    .footer-warning { font-weight: 600; color: #E5484D; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div style="padding: 10px;">
    <div class="container">
      <div class="header">
        <a href="${escapeHtml(actionUrl)}" class="header-logo">OFF<span>GRID</span></a>
        <div class="header-sub">Enterprise Emergency Response Network</div>
      </div>
      <div class="banner">
        ${escapeHtml(bannerTitle)}
      </div>
      <div class="content">
        ${incidentCode ? `<div class="incident-ref">REFERENCE: ${escapeHtml(incidentCode)}</div>` : ''}
        <h1 class="incident-title">${escapeHtml(title)}</h1>

        ${description ? `<div class="description-box">${escapeHtml(description)}</div>` : ''}

        <table class="meta-table">
          <tr>
            <td class="meta-cell meta-label">Severity Level</td>
            <td class="meta-cell meta-value">
              <span class="badge" style="background-color: ${sevColor};">${escapeHtml(sevLabel)}</span>
            </td>
          </tr>
          <tr>
            <td class="meta-cell meta-label">Notification Priority</td>
            <td class="meta-cell meta-value">${escapeHtml(priLabel)}</td>
          </tr>
          <tr>
            <td class="meta-cell meta-label">Current Status</td>
            <td class="meta-cell meta-value" style="text-transform: capitalize;">${escapeHtml(String(status).replace('_', ' '))}</td>
          </tr>
          <tr>
            <td class="meta-cell meta-label">Location / Zone</td>
            <td class="meta-cell meta-value">${escapeHtml(zone)}${address ? ` — ${escapeHtml(address)}` : ''}</td>
          </tr>
          ${teamName ? `<tr><td class="meta-cell meta-label">Assigned Response Team</td><td class="meta-cell meta-value" style="color: #F45B24;">${escapeHtml(teamName)}</td></tr>` : ''}
          ${peopleAffected > 0 ? `<tr><td class="meta-cell meta-label">People Affected</td><td class="meta-cell meta-value">${peopleAffected} person(s)</td></tr>` : ''}
          <tr>
            <td class="meta-cell meta-label">Recorded At</td>
            <td class="meta-cell meta-value">${escapeHtml(displayTime)}</td>
          </tr>
        </table>

        ${extraSectionHtml}

        <div style="text-align: center; margin-top: 24px;">
          <a href="${escapeHtml(actionUrl)}" class="btn-action">${escapeHtml(actionLabel)} &rarr;</a>
        </div>
      </div>
      <div class="footer">
        <div class="footer-warning">OFFICIAL EMERGENCY COMMUNICATION</div>
        <div>This is an automated notification from the OFFGRID Emergency Operations Center. If you are an assigned responder or coordinator, please acknowledge receipt in the Command Center immediately.</div>
        <div style="margin-top: 10px; font-size: 11px; color: #94A3B8;">&copy; ${new Date().getFullYear()} OFFGRID Emergency Response System &bull; Chennai Operations Node</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generators for all 12 system notification event types
 */
export const TEMPLATE_GENERATORS = {
  sos_activated: (payload) => {
    const { incident, nearestTeam, coordinates, sosId } = payload;
    const bannerTitle = '🚨 CRITICAL SOS EMERGENCY ACTIVATED — IMMEDIATE RESPONSE REQUIRED';
    const bannerColor = '#E5484D';
    const title = incident.title || 'SOS Beacon Activated';
    const description = incident.description || 'Emergency SOS beacon triggered. Immediate rescue assistance requested.';

    const extraHtml = `
      <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
        <strong style="color: #991B1B; font-size: 13px; text-transform: uppercase;">SOS Telemetry Data:</strong>
        <div style="font-size: 13px; color: #7F1D1D; margin-top: 6px; line-height: 1.5;">
          <div>&bull; SOS Reference ID: <strong>${escapeHtml(sosId || incident.code)}</strong></div>
          <div>&bull; Live GPS Position: <strong>${coordinates ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}` : `${incident.latitude}, ${incident.longitude}`}</strong></div>
          ${nearestTeam ? `<div>&bull; Nearest Eligible Unit: <strong>${escapeHtml(nearestTeam.name)}</strong> (${nearestTeam.etaMinutes ? `ETA ${nearestTeam.etaMinutes} min` : 'Standby'})</div>` : ''}
        </div>
      </div>
    `;

    return {
      subject: `[CRITICAL SOS] ${incident.code} — ${title} (${incident.zone || 'Emergency'})`,
      html: renderBaseLayout({
        bannerTitle,
        bannerColor,
        incidentCode: incident.code,
        title,
        description,
        severity: 5,
        priority: 'immediate',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        teamName: nearestTeam?.name || incident.assigned_team_name,
        peopleAffected: incident.people_affected,
        timestamp: incident.created_at,
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Acknowledge & Respond to SOS',
        extraSectionHtml: extraHtml,
      }),
      text: `[CRITICAL SOS] ${incident.code}: ${title}\nZone: ${incident.zone}\nSeverity: S5 (Critical)\nLocation: ${incident.address}\n\nImmediate rescue response required: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  incident_new: (payload) => {
    const { incident } = payload;
    const severity = incident.severity || 2;
    const isHigh = severity >= 4;
    const bannerTitle = isHigh ? '⚠️ HIGH-PRIORITY EMERGENCY INCIDENT REPORTED' : '📋 NEW EMERGENCY INCIDENT LOGGED';
    const bannerColor = isHigh ? '#F45B24' : '#101D2B';

    return {
      subject: `[${incident.urgency || 'NEW'}] ${incident.code} — ${incident.title} (${incident.zone})`,
      html: renderBaseLayout({
        bannerTitle,
        bannerColor,
        incidentCode: incident.code,
        title: incident.title,
        description: incident.description,
        severity,
        priority: isHigh ? 'high' : 'normal',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        peopleAffected: incident.people_affected,
        timestamp: incident.created_at,
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'View Incident in Command Center',
      }),
      text: `New incident reported: ${incident.code} - ${incident.title}\nSeverity: S${severity}\nZone: ${incident.zone}\nDetails: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  critical_detected: (payload) => {
    const { incident, classification } = payload;
    return {
      subject: `[CRITICAL ALERT] ${incident.code} — ${incident.title}`,
      html: renderBaseLayout({
        bannerTitle: '🚨 CRITICAL EMERGENCY DETECTED BY AI DISPATCH ENGINE',
        bannerColor: '#E5484D',
        incidentCode: incident.code,
        title: incident.title,
        description: incident.description,
        severity: 5,
        priority: 'immediate',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        peopleAffected: incident.people_affected,
        timestamp: incident.created_at,
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Direct Command Triage',
      }),
      text: `Critical emergency detected: ${incident.code} - ${incident.title}\nSeverity: S5\nImmediate coordinator review required: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  team_assigned: (payload) => {
    const { incident, team, etaMinutes } = payload;
    return {
      subject: `[TEAM DISPATCH] ${team.name} assigned to ${incident.code}`,
      html: renderBaseLayout({
        bannerTitle: '🚒 RESCUE TEAM ASSIGNED & DISPATCHED',
        bannerColor: '#F45B24',
        incidentCode: incident.code,
        title: `Dispatch Order: ${team.name} → ${incident.title}`,
        description: `Your unit has been assigned to active emergency ${incident.code}. Please review scene conditions and proceed to the designated coordinates.`,
        severity: incident.severity,
        priority: incident.severity >= 4 ? 'high' : 'normal',
        status: 'assigned',
        zone: incident.zone,
        address: incident.address,
        teamName: `${team.name} (${team.type})`,
        peopleAffected: incident.people_affected,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Acknowledge Assignment & Open Nav',
      }),
      text: `Dispatch order: ${team.name} assigned to incident ${incident.code} (${incident.title}). Please acknowledge: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  team_reassigned: (payload) => {
    const { incident, newTeam, previousTeam } = payload;
    return {
      subject: `[REASSIGNMENT] ${incident.code} transferred to ${newTeam.name}`,
      html: renderBaseLayout({
        bannerTitle: '🔄 INCIDENT REASSIGNMENT NOTIFICATION',
        bannerColor: '#3B7FF5',
        incidentCode: incident.code,
        title: `Incident Transferred: ${incident.title}`,
        description: `Operational assignment has been transferred from ${previousTeam?.name || 'previous unit'} to ${newTeam.name}.`,
        severity: incident.severity,
        priority: 'normal',
        status: 'assigned',
        zone: incident.zone,
        address: incident.address,
        teamName: newTeam.name,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'View Updated Assignment',
      }),
      text: `Incident ${incident.code} reassigned to ${newTeam.name}. Details: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  status_changed: (payload) => {
    const { incident, oldStatus, newStatus, actorName } = payload;
    return {
      subject: `[STATUS UPDATE] ${incident.code} is now ${newStatus.toUpperCase()}`,
      html: renderBaseLayout({
        bannerTitle: `STATUS UPDATED TO ${newStatus.toUpperCase()}`,
        bannerColor: newStatus === 'resolved' ? '#10B981' : '#3B7FF5',
        incidentCode: incident.code,
        title: `${incident.title} — Status Changed`,
        description: `Incident status was updated from "${oldStatus}" to "${newStatus}" by ${actorName || 'Operations'}.`,
        severity: incident.severity,
        priority: 'normal',
        status: newStatus,
        zone: incident.zone,
        address: incident.address,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Inspect Incident Timeline',
      }),
      text: `Incident ${incident.code} status changed from ${oldStatus} to ${newStatus}. http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  incident_resolved: (payload) => {
    const { incident, resolvedBy } = payload;
    return {
      subject: `[RESOLVED] ${incident.code} — ${incident.title}`,
      html: renderBaseLayout({
        bannerTitle: '✅ EMERGENCY INCIDENT RESOLVED & CLOSED',
        bannerColor: '#10B981',
        incidentCode: incident.code,
        title: `${incident.title} Successfully Resolved`,
        description: `The incident has been verified and marked as resolved by ${resolvedBy || 'Incident Command'}. Response teams have stood down.`,
        severity: incident.severity,
        priority: 'low',
        status: 'resolved',
        zone: incident.zone,
        address: incident.address,
        timestamp: incident.resolved_at || new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'View Final Report',
      }),
      text: `Incident ${incident.code} has been resolved by ${resolvedBy}. Report: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  duplicate_detected: (payload) => {
    const { incident, primaryIncident, score } = payload;
    return {
      subject: `[DUPLICATE REPORT] ${incident.code} matched with ${primaryIncident.code}`,
      html: renderBaseLayout({
        bannerTitle: '📑 DUPLICATE EMERGENCY REPORT FLAGGED',
        bannerColor: '#E9A426',
        incidentCode: incident.code,
        title: `Possible Duplicate: ${incident.title}`,
        description: `AI triage detected a ${Math.round(score * 100)}% correlation between newly reported incident ${incident.code} and active incident ${primaryIncident.code}.`,
        severity: incident.severity,
        priority: 'normal',
        status: incident.status,
        zone: incident.zone,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Review & Merge in Command Center',
      }),
      text: `Possible duplicate detected: ${incident.code} matches ${primaryIncident.code} (${Math.round(score * 100)}%). Review: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  broadcast_published: (payload) => {
    const { broadcast } = payload;
    const isCritical = broadcast.level === 'critical';
    return {
      subject: `[PUBLIC ALERT: ${broadcast.level.toUpperCase()}] ${broadcast.title}`,
      html: renderBaseLayout({
        bannerTitle: `📢 PUBLIC EMERGENCY ALERT — ${broadcast.level.toUpperCase()}`,
        bannerColor: isCritical ? '#E5484D' : '#F45B24',
        incidentCode: `ALERT-${broadcast.id}`,
        title: broadcast.title,
        description: broadcast.body,
        severity: isCritical ? 5 : 3,
        priority: isCritical ? 'immediate' : 'high',
        status: 'sent',
        zone: Array.isArray(broadcast.zones) && broadcast.zones.length ? broadcast.zones.join(', ') : 'All Zones',
        timestamp: broadcast.created_at,
        actionUrl: 'http://localhost:5173/broadcasts',
        actionLabel: 'View Broadcast Center',
      }),
      text: `PUBLIC ALERT (${broadcast.level.toUpperCase()}): ${broadcast.title}\n\n${broadcast.body}\n\nView alerts: http://localhost:5173/broadcasts`,
    };
  },

  assignment_overdue: (payload) => {
    const { incident, elapsedMinutes, slaMinutes } = payload;
    return {
      subject: `[SLA OVERDUE] ${incident.code} unacknowledged (${elapsedMinutes}m / SLA ${slaMinutes}m)`,
      html: renderBaseLayout({
        bannerTitle: '⏱️ EMERGENCY RESPONSE SLA OVERDUE',
        bannerColor: '#E5484D',
        incidentCode: incident.code,
        title: `SLA Breached: ${incident.title}`,
        description: `This incident has been waiting for response team acknowledgement for ${elapsedMinutes} minutes, exceeding the target SLA of ${slaMinutes} minutes.`,
        severity: incident.severity,
        priority: 'high',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Reassign or Escalate Immediately',
      }),
      text: `Emergency SLA overdue: ${incident.code} unacknowledged for ${elapsedMinutes} mins. Immediate action required: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  team_acknowledged: (payload) => {
    const { incident, team, acknowledgedBy } = payload;
    return {
      subject: `[ACKNOWLEDGED] ${team.name} confirmed dispatch for ${incident.code}`,
      html: renderBaseLayout({
        bannerTitle: '✅ ASSIGNMENT ACKNOWLEDGED BY RESPONSE TEAM',
        bannerColor: '#10B981',
        incidentCode: incident.code,
        title: `${team.name} Acknowledged Dispatch`,
        description: `Response team lead ${acknowledgedBy || team.leader_name || team.name} has formally acknowledged the dispatch order and is en route.`,
        severity: incident.severity,
        priority: 'normal',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        teamName: team.name,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Track Team Telemetry',
      }),
      text: `${team.name} acknowledged dispatch for ${incident.code}. Team is en route: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  escalation_triggered: (payload) => {
    const { incident, stage, targetRole, targetName, reason, thresholdMinutes } = payload;
    const stageTitles = {
      1: 'Stage 1: Response Unit Escalation',
      2: 'Stage 2: Regional Coordination Officer Escalation',
      3: 'Stage 3: Platform Administrator & Backup Teams Escalation',
      4: 'Stage 4: Network-Wide High Command Alert',
    };

    const extraHtml = `
      <div style="background-color: #FEF2F2; border-left: 4px solid #E5484D; padding: 14px; margin-bottom: 20px;">
        <strong style="color: #991B1B; font-size: 13px; text-transform: uppercase;">Escalation Details:</strong>
        <div style="font-size: 13px; color: #7F1D1D; margin-top: 6px; line-height: 1.6;">
          <div>&bull; Escalation Level: <strong>Stage ${stage} of 4</strong></div>
          <div>&bull; Target Authority: <strong>${escapeHtml(targetName || targetRole)}</strong> (${escapeHtml(targetRole)})</div>
          <div>&bull; Trigger Reason: <strong>${escapeHtml(reason || `Unacknowledged after ${thresholdMinutes} minutes`)}</strong></div>
        </div>
      </div>
    `;

    return {
      subject: `[ESCALATION STAGE ${stage}] ${incident.code} — ${incident.title}`,
      html: renderBaseLayout({
        bannerTitle: `⚠️ AUTOMATIC EMERGENCY ESCALATION — STAGE ${stage}`,
        bannerColor: '#E5484D',
        incidentCode: incident.code,
        title: stageTitles[stage] || `Emergency Escalation Stage ${stage}`,
        description: `Critical emergency ${incident.code} has triggered automated escalation due to unacknowledged response SLA. Executive authority intervention is requested.`,
        severity: 5,
        priority: 'immediate',
        status: incident.status,
        zone: incident.zone,
        address: incident.address,
        timestamp: new Date().toISOString(),
        actionUrl: `http://localhost:5173/incidents?open=${incident.id}`,
        actionLabel: 'Take Executive Action & Acknowledge',
        extraSectionHtml: extraHtml,
      }),
      text: `[EMERGENCY ESCALATION STAGE ${stage}] Incident ${incident.code} (${incident.title}) escalated to ${targetRole}. Reason: ${reason}. Action required: http://localhost:5173/incidents?open=${incident.id}`,
    };
  },

  test_notification: (payload) => {
    const { recipientEmail, recipientName, serverTime, provider, maskedUser } = payload;
    return {
      subject: '[TEST] OFFGRID Emergency Network — SMTP Connectivity Verification',
      html: renderBaseLayout({
        bannerTitle: '🧪 OFFGRID SMTP TEST NOTIFICATION',
        bannerColor: '#101D2B',
        incidentCode: 'TEST-SMTP-VERIFY',
        title: 'SMTP Email Delivery Channel Operational',
        description: 'This is a test notification confirming that the OFFGRID backend SMTP email infrastructure, TLS encryption, and responsive HTML template rendering are functioning correctly.',
        severity: 1,
        priority: 'low',
        status: 'verified',
        zone: 'Central Hub',
        address: 'Server Outbound Relay',
        timestamp: serverTime || new Date().toISOString(),
        actionUrl: 'http://localhost:5173/settings',
        actionLabel: 'Open System Settings',
        extraSectionHtml: `
          <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
            <strong style="color: #166534; font-size: 13px;">Connectivity Diagnostics:</strong>
            <div style="font-size: 13px; color: #15803D; margin-top: 6px;">
              <div>&bull; Recipient: <strong>${escapeHtml(recipientName || recipientEmail)}</strong></div>
              <div>&bull; Outbound Provider: <strong>${escapeHtml(provider || 'Custom SMTP')}</strong></div>
              <div>&bull; Authenticated Account: <strong>${escapeHtml(maskedUser || 'Active')}</strong></div>
              <div>&bull; Transport Protocol: <strong>TLS / STARTTLS Encrypted</strong></div>
            </div>
          </div>
        `,
      }),
      text: `OFFGRID SMTP Test: Email delivery infrastructure verified successfully for ${recipientEmail}.`,
    };
  },
};

/**
 * Format email template for any given event type
 */
export function formatEmailTemplate(eventType, payload) {
  const generator = TEMPLATE_GENERATORS[eventType] || TEMPLATE_GENERATORS.incident_new;
  return generator(payload);
}

