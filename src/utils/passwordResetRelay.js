// The configured relay is the sole delivery path; falling back to SMTP on
// Render Free would conceal the actual failure and delay the response.
export async function sendPasswordResetViaRelay(to, resetLink) {
  let endpoint;
  const secret = String(process.env.EMAIL_RELAY_SECRET ?? '').trim();
  try {
    const base = new URL(String(process.env.EMAIL_RELAY_URL ?? '').trim());
    if (base.protocol !== 'https:' || base.username || base.password
      || base.search || base.hash || !['', '/'].includes(base.pathname)
      || secret.length < 32) throw new Error();
    endpoint = new URL('/send-password-reset', base).toString();
  } catch {
    throw new Error('Invalid password reset email relay configuration.');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ to, resetLink }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || (await response.json()).success !== true) throw new Error();
    return { accepted: [to] };
  } catch {
    // Provider responses and network errors can contain credentials or tokens.
    throw new Error('Password reset email relay delivery failed.');
  }
}
