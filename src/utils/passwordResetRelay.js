// The configured relay is the sole delivery path; falling back to SMTP on
// Render Free would conceal the actual failure and delay the response.
async function sendViaRelay(path, payload, label) {
  let endpoint;
  const secret = String(process.env.EMAIL_RELAY_SECRET ?? '').trim();
  try {
    const base = new URL(String(process.env.EMAIL_RELAY_URL ?? '').trim());
    if (base.protocol !== 'https:' || base.username || base.password
      || base.search || base.hash || !['', '/'].includes(base.pathname)
      || secret.length < 32) throw new Error();
    endpoint = new URL(path, base).toString();
  } catch {
    throw new Error(`Invalid ${label.toLowerCase()} email relay configuration.`);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || (await response.json()).success !== true) throw new Error();
    return { accepted: [payload.to] };
  } catch {
    // Provider responses and network errors can contain credentials or tokens.
    throw new Error(`${label} email relay delivery failed.`);
  }
}

export const sendPasswordResetViaRelay = (to, resetLink) =>
  sendViaRelay('/send-password-reset', { to, resetLink }, 'Password reset');

export const sendVerificationViaRelay = (to, verificationLink) =>
  sendViaRelay('/send-verification', { to, verificationLink }, 'Verification');
