import nodemailer from 'nodemailer';

/**
 * Reads SMTP configuration safely from process.env.
 * Never exposes passwords or unmasked credentials.
 */
export function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const fromName = (process.env.SMTP_FROM_NAME || 'OFFGRID Emergency Network').trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user || 'alerts@offgrid.in').trim();

  // Determine provider type for display / tuning
  let provider = 'custom';
  if (host.includes('gmail.com')) provider = 'gmail';
  else if (host.includes('outlook.com') || host.includes('office365.com')) provider = 'outlook';
  else if (host.includes('sendgrid.net')) provider = 'sendgrid';
  else if (host.includes('amazonaws.com')) provider = 'ses';

  const isConfigured = Boolean(host && user && pass);

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
    provider,
    isConfigured,
  };
}

/**
 * Returns a sanitized view of SMTP status for API / dashboard consumption.
 * Strictly hides passwords and partially masks username.
 */
export function getMaskedSmtpStatus() {
  const config = getSmtpConfig();
  let maskedUser = null;
  if (config.user) {
    const parts = config.user.split('@');
    if (parts.length === 2) {
      const name = parts[0];
      const maskedName = name.length <= 2 ? `${name[0]}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
      maskedUser = `${maskedName}@${parts[1]}`;
    } else {
      maskedUser = 'configured (masked)';
    }
  }

  return {
    configured: config.isConfigured,
    provider: config.provider,
    host: config.host || '(not set)',
    port: config.port,
    secure: config.secure,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    maskedUser,
    supportsEncryption: true,
    supportedPorts: [465, 587, 25],
  };
}

let cachedTransporter = null;
let lastConfigHash = '';

function getTransporter() {
  const config = getSmtpConfig();
  if (!config.isConfigured) return null;

  const currentHash = `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass}`;
  if (cachedTransporter && lastConfigHash === currentHash) {
    return cachedTransporter;
  }

  const transportOpts = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  };

  // Gmail special optimization
  if (config.provider === 'gmail') {
    transportOpts.service = 'gmail';
  }

  cachedTransporter = nodemailer.createTransport(transportOpts);
  lastConfigHash = currentHash;
  return cachedTransporter;
}

/**
 * Tests the live SMTP connection.
 * Resolves with connection status details or rejects with descriptive error.
 */
export async function testSmtpConnection() {
  const config = getSmtpConfig();
  if (!config.isConfigured) {
    return {
      connected: false,
      configured: false,
      message: 'SMTP is not fully configured in environment variables (requires SMTP_HOST, SMTP_USER, SMTP_PASS).',
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      connected: false,
      configured: false,
      message: 'Failed to initialize SMTP transporter.',
    };
  }

  try {
    await transporter.verify();
    return {
      connected: true,
      configured: true,
      host: config.host,
      port: config.port,
      secure: config.secure,
      provider: config.provider,
      message: `Successfully connected and authenticated with ${config.provider.toUpperCase()} SMTP server (${config.host}:${config.port}).`,
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      error: error.message || 'SMTP connection verification failed.',
      code: error.code || 'ECONNECTION',
      host: config.host,
      port: config.port,
    };
  }
}

/**
 * Sends an email message.
 * Returns delivery confirmation details or returns error object (never throws).
 */
export async function sendMail({ to, subject, html, text, priority = 'normal', headers = {} }) {
  const config = getSmtpConfig();

  if (!config.isConfigured) {
    return {
      accepted: false,
      notConfigured: true,
      error: 'SMTP credentials not configured in environment variables. Email logged in delivery audit.',
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      accepted: false,
      error: 'SMTP transporter unavailable.',
    };
  }

  const fromAddress = `"${config.fromName}" <${config.fromEmail}>`;

  // Priority header mapping
  const priorityHeader = priority === 'immediate' || priority === 'critical' || priority === 'high' ? 'high' : 'normal';
  const mailHeaders = {
    'X-OFFGRID-Priority': priority,
    'X-OFFGRID-System': 'Emergency Response Network v1.0',
    ...headers,
  };
  if (priority === 'immediate' || priority === 'critical') {
    mailHeaders['X-Priority'] = '1';
    mailHeaders['Importance'] = 'high';
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || html?.replace(/<[^>]+>/g, ' ') || '',
      html,
      priority: priorityHeader,
      headers: mailHeaders,
    });

    return {
      accepted: true,
      messageId: info.messageId,
      acceptedRecipients: info.accepted,
      rejectedRecipients: info.rejected,
      response: info.response,
    };
  } catch (error) {
    return {
      accepted: false,
      error: error.message || 'Failed to send email via SMTP.',
      code: error.code || 'ESENDFAIL',
    };
  }
}

