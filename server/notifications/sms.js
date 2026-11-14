/**
 * Optional SMS Gateway Integration (Twilio / Webhook).
 * Provides graceful fallback when SMS credentials are not provided.
 */

export function getSmsConfig() {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromPhone = (process.env.TWILIO_FROM_PHONE || '').trim();

  return {
    configured: Boolean(accountSid && authToken && fromPhone),
    accountSid,
    fromPhone,
  };
}

export async function sendSms({ to, message }) {
  const config = getSmsConfig();

  if (!config.configured) {
    return {
      success: false,
      notConfigured: true,
      error: 'Twilio SMS credentials not configured in environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE). Recorded in audit log.',
      simulated: true,
    };
  }

  try {
    // If Twilio credentials exist, make standard REST call to Twilio API
    const auth = Buffer.from(`${config.accountSid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({
      From: config.fromPhone,
      To: to,
      Body: message.slice(0, 160),
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (response.ok) {
      return {
        success: true,
        messageId: data.sid,
        status: data.status,
      };
    } else {
      return {
        success: false,
        error: data.message || `Twilio HTTP ${response.status}`,
        code: data.code,
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.message || 'SMS transmission failed',
    };
  }
}

