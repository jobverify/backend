import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 2048;
const mailboxPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;
const isMailbox = value => typeof value === 'string' && value.length <= 254 && mailboxPattern.test(value);
const reply = (status, error, headers = {}) => Response.json(
  error ? { success: false, error } : { success: true },
  { status, headers: { 'Cache-Control': 'no-store', ...headers } },
);

function configuration(env) {
  const secret = String(env.RELAY_SECRET ?? '').trim();
  const user = String(env.GMAIL_USER ?? '').trim();
  const pass = String(env.GMAIL_APP_PASSWORD ?? '').replace(/\s/g, '');
  let frontend;
  try { frontend = new URL(env.FRONTEND_ORIGIN); } catch { return null; }
  if (secret.length < 32 || !isMailbox(user) || !pass
    || frontend.protocol !== 'https:' || frontend.username || frontend.password
    || frontend.pathname !== '/' || frontend.search || frontend.hash
    || typeof env.GLOBAL_LIMITER?.limit !== 'function'
    || typeof env.RECIPIENT_LIMITER?.limit !== 'function') return null;
  return { secret, user, pass, origin: frontend.origin };
}

function authorized(request, secret) {
  const actual = Buffer.from(request.headers.get('Authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readPayload(request) {
  // Bound the stream itself: Content-Length is optional and untrusted.
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    throw Object.assign(new Error(), { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error(), { status: 400 });
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error(), { status: 413 });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validPayload(payload, origin, verification) {
  const linkKey = verification ? 'verificationLink' : 'resetLink';
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).length !== 2 || !isMailbox(payload.to)
    || typeof payload[linkKey] !== 'string' || payload[linkKey].length > 1024) return false;
  try {
    const link = new URL(payload[linkKey]);
    return link.origin === origin && link.pathname === (verification ? '/verify-email' : '/reset-password')
      && !link.username && !link.password && !link.search
      && /^#token=[0-9a-f]{64}$/i.test(link.hash);
  } catch { return false; }
}

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function resetEmail(payload, user) {
  return {
    from: `Jobverify <${user}>`, to: payload.to,
    subject: 'Reset your Jobverify password',
    text: `Use this link to set a new Jobverify password:\n\n${payload.resetLink}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>Reset your Jobverify password</h2>
      <p>Use the link below to set a custom password. This link expires in 30 minutes.</p>
      <p><a href="${escapeHtml(payload.resetLink)}">Set your password</a></p>
      <p>If you did not request this email, you can safely ignore it.</p>
    </div>`,
  };
}

function verificationEmail(payload, user) {
  return {
    from: `Jobverify <${user}>`, to: payload.to,
    subject: 'Verify your Jobverify account',
    text: `Welcome to Jobverify! Use this link to verify your email address:\n\n${payload.verificationLink}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <h2>Welcome to Jobverify!</h2>
      <p>Use the link below to verify your email address. This link expires in 30 minutes.</p>
      <p><a href="${escapeHtml(payload.verificationLink)}">Verify Email Address</a></p>
      <p>If you did not request this email, you can safely ignore it.</p>
    </div>`,
  };
}

export function createRelayHandler({ createTransport }) {
  return async function handleRequest(request, env) {
    const path = new URL(request.url).pathname;
    if (!['/send-password-reset', '/send-verification', '/verify-smtp'].includes(path)) return reply(404, 'NOT_FOUND');
    const verification = path === '/send-verification';
    if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED', { Allow: 'POST' });
    const config = configuration(env);
    if (!config) return reply(503, 'RELAY_NOT_CONFIGURED');
    if (!authorized(request, config.secret)) return reply(401, 'UNAUTHORIZED');

    let payload;
    if (path !== '/verify-smtp') {
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return reply(415, 'JSON_REQUIRED');
      }
      try { payload = await readPayload(request); }
      catch (error) { return reply(error.status === 413 ? 413 : 400, 'INVALID_PAYLOAD'); }
      if (!validPayload(payload, config.origin, verification)) return reply(400, 'INVALID_PAYLOAD');
    }

    let transporter;
    try {
      if (!(await env.GLOBAL_LIMITER.limit({ key: 'gmail-relay' })).success) {
        return reply(429, 'RATE_LIMITED', { 'Retry-After': '60' });
      }
      if (payload) {
        const key = createHash('sha256').update(payload.to.toLowerCase()).digest('hex');
        if (!(await env.RECIPIENT_LIMITER.limit({ key })).success) {
          return reply(429, 'RATE_LIMITED', { 'Retry-After': '60' });
        }
      }
      transporter = createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
        disableFileAccess: true, disableUrlAccess: true,
        logger: false, debug: false,
      });
      if (path === '/verify-smtp') await transporter.verify();
      else {
        const result = await transporter.sendMail((verification ? verificationEmail : resetEmail)(payload, config.user));
        if (!result.accepted?.some(address => typeof address === 'string' && address.toLowerCase() === payload.to.toLowerCase())) {
          throw new Error('Recipient not accepted');
        }
      }
      return reply(200);
    } catch (error) {
      // Never log provider responses, credentials, addresses or account links.
      const code = ['EAUTH', 'ETIMEDOUT', 'EDNS', 'ESOCKET', 'ECONNECTION', 'EENVELOPE', 'ETLS'].includes(error?.code)
        ? error.code : 'DELIVERY_FAILED';
      const reason = String(error?.message ?? '').includes('proxy request failed') ? 'SOCKET_PROXY_FAILURE'
        : /certificate|SSL|TLS/i.test(String(error?.message ?? '')) ? 'TLS_FAILURE'
          : /not implemented|unsupported/i.test(String(error?.message ?? '')) ? 'RUNTIME_UNSUPPORTED'
            : 'SMTP_FAILURE';
      console.error('Gmail relay failed:', code, reason);
      return reply(503, 'SMTP_UNAVAILABLE');
    } finally { transporter?.close(); }
  };
}
