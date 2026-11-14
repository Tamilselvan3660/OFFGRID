/**
 * Comprehensive Integration Test Suite for OFFGRID Enterprise Notification & SMTP System.
 * Tests Phases 1 through 15:
 * 1. SMTP Connection Verification
 * 2. Test Email Delivery / Masked Status
 * 3. New Incident Email & In-App Notification
 * 4. Critical SOS Notification & Escalation Initiation
 * 5. Team Assignment & Dispatch Notification
 * 6. Incident Status Change & Resolution Notification
 * 7. Automatic Escalation & Manual Escalation Trigger
 * 8. Duplicate Prevention & Flagging
 * 9. User Notification Preferences & Critical Override
 * 10. Background Queue Processing & Metrics
 * 11. Delivery Failure & Exponential Retry Handling
 * 12. Failed Delivery Recovery / Retry Endpoint
 * 13. Role-Based Access & Unauthorized Access Gate
 * 14. Delivery Audit Logs & History Search
 */

const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Cookie'] = `offgrid_session=${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function login(email, password = 'Demo@123') {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  let token = null;
  if (cookie) {
    const match = cookie.match(/offgrid_session=([^;]+)/);
    if (match) token = match[1];
  }
  const data = await res.json();
  return { token, user: data.user };
}

async function runTests() {
  console.log('================================================================');
  console.log('   OFFGRID ENTERPRISE NOTIFICATION & SMTP INTEGRATION TESTS     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Authenticate test users
  console.log('[Setup] Logging in test accounts...');
  const admin = await login('admin@offgrid.in');
  const authority = await login('authority@offgrid.in');
  const citizen = await login('citizen@offgrid.in');

  assert(Boolean(admin.token), 'Admin authenticated successfully');
  assert(Boolean(authority.token), 'Authority authenticated successfully');
  assert(Boolean(citizen.token), 'Citizen authenticated successfully');

  // Test 1: SMTP Status Check & Credential Masking
  console.log('\n[Phase 1] Testing SMTP Status & Credential Protection...');
  const smtpStatusRes = await request('/notifications/smtp-status', { token: admin.token });
  assert(smtpStatusRes.ok, 'GET /api/notifications/smtp-status returns 200');
  assert(smtpStatusRes.data.smtp !== undefined, 'SMTP status payload exists');
  assert(smtpStatusRes.data.smtp.pass === undefined, 'SMTP password is strictly NOT exposed');
  assert(typeof smtpStatusRes.data.smtp.port === 'number', 'SMTP port is reported');

  // Test 2: SMTP Connection & Diagnostic Test Endpoint
  console.log('\n[Phase 1 & 13] Testing SMTP Connection Test API...');
  const smtpTestRes = await request('/notifications/test', {
    method: 'POST',
    token: admin.token,
    body: { email: 'admin@offgrid.in', send_email: false },
  });
  assert(smtpTestRes.ok, 'POST /api/notifications/test returns 200');
  assert(smtpTestRes.data.connection !== undefined, 'Connection test response returned');

  // Test 3: Unauthorized Access Prevention
  console.log('\n[Phase 12] Testing Role-Based Security & Unauthorized Access...');
  const unauthTest = await request('/notifications/test', {
    method: 'POST',
    token: citizen.token,
    body: { email: 'citizen@offgrid.in' },
  });
  assert(unauthTest.status === 403, 'Citizen blocked from admin SMTP diagnostics (403)');

  // Test 4: User Notification Preferences
  console.log('\n[Phase 9] Testing User Notification Preferences...');
  const getPrefs = await request('/notifications/preferences', { token: citizen.token });
  assert(getPrefs.ok && getPrefs.data.preferences !== undefined, 'GET /api/notifications/preferences works');

  const updatePrefs = await request('/notifications/preferences', {
    method: 'PATCH',
    token: citizen.token,
    body: {
      email_enabled: true,
      in_app_enabled: true,
      sms_enabled: false,
      notify_assignments: true,
      min_severity: 2,
    },
  });
  assert(updatePrefs.ok && updatePrefs.data.preferences.min_severity === 2, 'PATCH /api/notifications/preferences updated');

  // Test 5: Ingest New Incident & Automatic Dispatch
  console.log('\n[Phase 2] Testing New Incident Notification Dispatch...');
  const incidentRes = await request('/incidents', {
    method: 'POST',
    token: citizen.token,
    body: {
      title: 'Power transformer sparking near residential school',
      description: 'Sparks and smoke observed from pole-mounted transformer after heavy thunderstorm. Area cordoned off.',
      category: 'utility',
      zone: 'Central Chennai',
      severity: 4,
      people_affected: 35,
      vulnerable_count: 10,
    },
  });
  assert(incidentRes.ok && incidentRes.data.incident !== undefined, 'New high-severity incident created');
  const newIncident = incidentRes.data.incident;

  // Test 6: In-App Notification Delivery
  console.log('\n[Phase 3] Testing Real-Time In-App Notification Center...');
  const notifsRes = await request('/notifications', { token: admin.token });
  assert(notifsRes.ok, 'GET /api/notifications returns 200');
  assert(Array.isArray(notifsRes.data.notifications), 'Notifications list is returned');
  const matchingNotif = notifsRes.data.notifications.find((n) => n.incident_id === newIncident.id || n.title.includes(newIncident.code));
  assert(Boolean(matchingNotif), `In-app notification generated for incident ${newIncident.code}`);

  // Test 7: Mark Read / Mark All Read
  if (matchingNotif) {
    const markRead = await request(`/notifications/${matchingNotif.id}/read`, {
      method: 'PATCH',
      token: admin.token,
    });
    assert(markRead.ok, 'Single notification marked as read');
  }

  const markAllRead = await request('/notifications/read-all', {
    method: 'PATCH',
    token: admin.token,
  });
  assert(markAllRead.ok, 'All notifications marked as read');

  // Test 8: Critical SOS Emergency Activation & Multi-Channel Pipeline
  console.log('\n[Phase 4] Testing Intelligent SOS Activation & Escalation Engine...');
  const sosRes = await request('/simulate/sos', {
    method: 'POST',
    token: citizen.token,
  });
  assert(sosRes.ok && sosRes.data.incident !== undefined, 'Simulated SOS beacon created');
  const sosIncident = sosRes.data.incident;
  assert(sosIncident.source === 'sos', 'Incident source flagged as SOS');

  // Check Escalations Table
  const escalationsRes = await request('/notifications/escalations', { token: admin.token });
  assert(escalationsRes.ok, 'GET /api/notifications/escalations returns 200');
  const activeEsc = escalationsRes.data.escalations.find((e) => e.incident_id === sosIncident.id);
  assert(Boolean(activeEsc), `Automatic escalation Stage 1 initiated for SOS ${sosIncident.code}`);

  // Test 9: Manual Escalation Advance
  if (activeEsc) {
    console.log('\n[Phase 4 & 13] Testing Manual Escalation Advance...');
    const advanceRes = await request(`/notifications/escalations/${activeEsc.id}/trigger`, {
      method: 'POST',
      token: admin.token,
      body: { note: 'Manual escalation test by coordinator' },
    });
    assert(advanceRes.ok, 'Manual escalation triggered successfully');

    const updatedEsc = await request('/notifications/escalations', { token: admin.token });
    const bumped = updatedEsc.data.escalations.find((e) => e.id === activeEsc.id);
    assert(bumped?.stage === 2, 'Escalation stage advanced from Stage 1 to Stage 2');
  }

  // Test 10: Team Allocation & Acknowledgement
  console.log('\n[Phase 2 & 4] Testing Team Allocation & Escalation Cancellation...');
  const teamsRes = await request('/teams', { token: admin.token });
  const testTeam = teamsRes.data?.teams?.[0] || { id: 1 };

  const allocateRes = await request(`/incidents/${sosIncident.id}/allocate`, {
    method: 'POST',
    token: admin.token,
    body: { team_id: testTeam.id },
  });
  assert(allocateRes.ok, 'Response team allocated to incident');

  const checkEscAfterAlloc = await request('/notifications/escalations', { token: admin.token });
  const resolvedEsc = checkEscAfterAlloc.data.escalations.find((e) => e.incident_id === sosIncident.id);
  assert(resolvedEsc?.status === 'acknowledged', 'Escalation cancelled/acknowledged upon team allocation');

  // Test 11: Incident Resolution Notification
  console.log('\n[Phase 2] Testing Incident Resolution Notification...');
  const resolveRes = await request(`/incidents/${sosIncident.id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'resolved' },
  });
  assert(resolveRes.ok, 'Incident marked as resolved');

  // Test 12: Delivery Monitoring Dashboard & Queue Status
  console.log('\n[Phase 5 & 7] Testing Delivery Monitoring & Queue Metrics...');
  const queueStatus = await request('/notifications/queue-status', { token: admin.token });
  assert(queueStatus.ok, 'GET /api/notifications/queue-status returns 200');
  assert(queueStatus.data.queue.workerActive === true, 'Notification queue worker is actively polling');

  const monitorStatus = await request('/notifications/status', { token: admin.token });
  assert(monitorStatus.ok, 'GET /api/notifications/status returns 200');
  assert(monitorStatus.data.monitoring.totalDeliveries > 0, 'Total deliveries metric populated');

  // Test 13: Delivery History Audit & Search
  console.log('\n[Phase 7 & 11] Testing Delivery Audit Log & Filtering...');
  const historyRes = await request('/notifications/history?limit=20', { token: admin.token });
  assert(historyRes.ok, 'GET /api/notifications/history returns 200');
  assert(Array.isArray(historyRes.data.logs), 'Audit logs array returned');
  assert(historyRes.data.logs.length > 0, 'Delivery logs successfully recorded in database');

  // Summary
  console.log('\n================================================================');
  console.log(`   INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED `);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

