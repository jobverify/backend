import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelayHandler } from '../src/relay.js';

const secret = 'relay-test-secret-with-at-least-32-characters';
const token = 'a'.repeat(64);
const resetLink = `https://jobverify.test/reset-password#token=${token}`;
const body = { to: 'owner@gmail.com', resetLink };

function fixture(t, overrides = {}) {
  const calls = { transports: [], mail: [], verified: 0, closed: 0, rateKeys: [] };
  const transport = {
    sendMail: async mail => { calls.mail.push(mail); return { accepted: [mail.to], rejected: [] }; },
    verify: async () => { calls.verified++; return true; },
    close: () => { calls.closed++; },
  };
  const env = {
    RELAY_SECRET: secret, GMAIL_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'app password example',
    FRONTEND_ORIGIN: 'https://jobverify.test',
    GLOBAL_LIMITER: { limit: async ({ key }) => { calls.rateKeys.push(key); return { success: true }; } },
    RECIPIENT_LIMITER: { limit: async ({ key }) => { calls.rateKeys.push(key); return { success: true }; } },
    ...overrides,
  };
  const handler = createRelayHandler({ createTransport: options => { calls.transports.push(options); return transport; } });
  const request = (payload = body, options = {}) => new Request('https://relay.test/send-password-reset', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), ...options,
  });
  t.mock.method(console, 'error', () => {});
  return { calls, transport, env, handler, request };
}

test('relay delivers one fixed Gmail template and waits for SMTP acceptance', async t => {
  const { calls, transport, env, handler, request } = fixture(t);
  let accept;
  const pending = new Promise(resolve => { accept = resolve; });
  transport.sendMail = async mail => { calls.mail.push(mail); await pending; return { accepted: [mail.to] }; };
  let settled = false;
  const delivery = handler(request(), env).then(response => { settled = true; return response; });
  await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(settled, false); }
  finally { accept(); }
  const response = await delivery;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls.mail.length, 1);
  assert.equal(calls.mail[0].to, body.to);
  assert.equal(calls.mail[0].from, 'Jobverify <sender@gmail.com>');
  assert.equal(calls.mail[0].subject, 'Reset your Jobverify password');
  assert.ok(calls.mail[0].text.includes(resetLink));
  assert.ok(calls.mail[0].html.includes(resetLink));
  assert.equal(calls.transports[0].host, 'smtp.gmail.com');
  assert.equal(calls.transports[0].port, 465);
  assert.equal(calls.transports[0].secure, true);
  assert.equal(calls.transports[0].auth.user, env.GMAIL_USER);
  assert.equal(calls.transports[0].disableFileAccess, true);
  assert.equal(calls.transports[0].disableUrlAccess, true);
  assert.equal(calls.closed, 1);
  assert.equal(calls.rateKeys.length, 2);
  assert.ok(calls.rateKeys.every(key => !key.includes('@')), 'do not store raw recipient addresses in rate keys');
});

for (const authorization of ['', 'Bearer wrong', `Basic ${secret}`, `Bearer ${secret}x`]) {
  test(`relay rejects invalid authorization (${authorization.slice(0, 12)}) before SMTP`, async t => {
    const { calls, env, handler, request } = fixture(t);
    const response = await handler(request(body, { headers: { Authorization: authorization } }), env);
    assert.equal(response.status, 401);
    assert.equal(calls.transports.length, 0);
    assert.equal(calls.rateKeys.length, 0);
  });
}

for (const invalid of [
  { to: 'first@gmail.com,second@gmail.com', resetLink },
  { to: 'owner@gmail.com\r\nBcc: victim@gmail.com', resetLink },
  { to: ['owner@gmail.com'], resetLink },
  { to: 'owner@gmail.com', resetLink: `https://evil.test/reset-password#token=${token}` },
  { to: 'owner@gmail.com', resetLink: `http://jobverify.test/reset-password#token=${token}` },
  { to: 'owner@gmail.com', resetLink: `https://jobverify.test/reset-password?next=evil#token=${token}` },
  { to: 'owner@gmail.com', resetLink: `https://jobverify.test/reset-password#token=${token}&next=evil` },
  { to: 'owner@gmail.com', resetLink: `https://user:pass@jobverify.test/reset-password#token=${token}` },
  { to: 'owner@gmail.com', resetLink: 'https://jobverify.test/reset-password#token=short' },
  { to: 'owner@gmail.com', resetLink: `https://jobverify.test/verify-email#token=${token}` },
  { ...body, html: '<a href="https://evil.test">malicious</a>' },
  { ...body, from: 'spoofed@gmail.com' },
  null,
]) {
  test(`relay rejects invalid mail payload ${JSON.stringify(invalid).slice(0, 100)}`, async t => {
    const { calls, env, handler, request } = fixture(t);
    assert.equal((await handler(request(invalid), env)).status, 400);
    assert.equal(calls.transports.length, 0);
  });
}

test('relay rejects oversized, malformed and non-JSON bodies', async t => {
  const { calls, env, handler, request } = fixture(t);
  assert.equal((await handler(request(body, { body: 'x'.repeat(2049) }), env)).status, 413);
  assert.equal((await handler(request(body, { body: '{' }), env)).status, 400);
  assert.equal((await handler(request(body, { headers: { Authorization: `Bearer ${secret}` } }), env)).status, 415);
  assert.equal(calls.transports.length, 0);
});

for (const missing of ['RELAY_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'FRONTEND_ORIGIN', 'GLOBAL_LIMITER', 'RECIPIENT_LIMITER']) {
  test(`relay fails closed when ${missing} is missing`, async t => {
    const { calls, env, handler, request } = fixture(t, { [missing]: undefined });
    assert.equal((await handler(request(), env)).status, 503);
    assert.equal(calls.transports.length, 0);
  });
}

test('relay refuses HTTP origins and short secrets', async t => {
  for (const overrides of [{ RELAY_SECRET: 'short' }, { FRONTEND_ORIGIN: 'http://jobverify.test' }]) {
    const { calls, env, handler, request } = fixture(t, overrides);
    assert.equal((await handler(request(), env)).status, 503);
    assert.equal(calls.transports.length, 0);
  }
});

for (const binding of ['GLOBAL_LIMITER', 'RECIPIENT_LIMITER']) {
  test(`relay enforces ${binding} before SMTP`, async t => {
    const { calls, env, handler, request } = fixture(t, { [binding]: { limit: async () => ({ success: false }) } });
    const response = await handler(request(), env);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(calls.transports.length, 0);
  });
}

test('relay does not expose Gmail errors or accept a rejected recipient', async t => {
  const { calls, transport, env, handler, request } = fixture(t);
  transport.sendMail = async () => { throw Object.assign(new Error(`private password ${env.GMAIL_APP_PASSWORD} link ${resetLink}`), { code: 'EAUTH' }); };
  const response = await handler(request(), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { success: false, error: 'SMTP_UNAVAILABLE' });
  assert.equal(calls.closed, 1);
  transport.sendMail = async () => ({ accepted: [], rejected: [body.to] });
  assert.equal((await handler(request(), env)).status, 503);
});

test('relay fails closed if rate-limit storage is unavailable', async t => {
  const { calls, env, handler, request } = fixture(t, {
    GLOBAL_LIMITER: { limit: async () => { throw new Error('storage unavailable'); } },
  });
  assert.equal((await handler(request(), env)).status, 503);
  assert.equal(calls.transports.length, 0);
});

test('socket failures log a safe diagnostic category without provider text or credentials', async t => {
  const { transport, env, handler, request } = fixture(t);
  const logs = [];
  t.mock.method(console, 'error', (...parts) => logs.push(parts));
  transport.verify = async () => {
    throw Object.assign(new Error(`proxy request failed, cannot connect to the specified address ${env.GMAIL_APP_PASSWORD}`), { code: 'ESOCKET', command: 'CONN' });
  };
  const response = await handler(new Request('https://relay.test/verify-smtp', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` },
  }), env);
  assert.equal(response.status, 503);
  assert.deepEqual(logs[0], ['Gmail relay failed:', 'ESOCKET', 'SOCKET_PROXY_FAILURE']);
});

test('SMTP verification requires authentication and sends no email', async t => {
  const { calls, env, handler } = fixture(t);
  const url = 'https://relay.test/verify-smtp';
  assert.equal((await handler(new Request(url, { method: 'POST' }), env)).status, 401);
  const response = await handler(new Request(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }), env);
  assert.equal(response.status, 200);
  assert.equal(calls.verified, 1);
  assert.equal(calls.mail.length, 0);
});

test('relay rejects unknown paths and non-POST requests', async t => {
  const { calls, env, handler } = fixture(t);
  assert.equal((await handler(new Request('https://relay.test/other'), env)).status, 404);
  assert.equal((await handler(new Request('https://relay.test/send-password-reset'), env)).status, 405);
  assert.equal(calls.transports.length, 0);
});

const verificationLink = `https://jobverify.test/verify-email#token=${token}`;
const verificationBody = { to: body.to, verificationLink };
const verificationRequest = (payload = verificationBody, authorization = `Bearer ${secret}`) => new Request('https://relay.test/send-verification', {
  method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

test('verification relay waits for SMTP acceptance and sends a fixed verification template', async t => {
  const { calls, transport, env, handler } = fixture(t);
  let accept;
  const pending = new Promise(resolve => { accept = resolve; });
  transport.sendMail = async mail => { calls.mail.push(mail); await pending; return { accepted: [mail.to] }; };
  let settled = false;
  const delivery = handler(verificationRequest(), env).then(response => { settled = true; return response; });
  await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(settled, false); } finally { accept(); }
  assert.equal((await delivery).status, 200);
  assert.equal(calls.mail[0].from, 'Jobverify <sender@gmail.com>');
  assert.equal(calls.mail[0].to, body.to);
  assert.equal(calls.mail[0].subject, 'Verify your Jobverify account');
  assert.ok(calls.mail[0].text.includes(verificationLink));
  assert.ok(calls.mail[0].html.includes(verificationLink));
  assert.equal(calls.closed, 1);
  assert.equal(calls.rateKeys.length, 2);
});

test('verification relay requires authentication and enforces recipient limits', async t => {
  const { calls, env, handler } = fixture(t);
  assert.equal((await handler(verificationRequest(verificationBody, ''), env)).status, 401);
  env.RECIPIENT_LIMITER.limit = async () => ({ success: false });
  assert.equal((await handler(verificationRequest(), env)).status, 429);
  assert.equal(calls.transports.length, 0);
});

test('verification relay returns a safe error when Gmail rejects delivery', async t => {
  const { calls, transport, env, handler } = fixture(t);
  transport.sendMail = async () => { throw new Error(`private ${env.GMAIL_APP_PASSWORD} ${verificationLink}`); };
  const response = await handler(verificationRequest(), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { success: false, error: 'SMTP_UNAVAILABLE' });
  assert.equal(calls.closed, 1);
});

for (const invalid of [
  body,
  { ...verificationBody, verificationLink: resetLink },
  { ...verificationBody, verificationLink: `https://evil.test/verify-email#token=${token}` },
  { ...verificationBody, verificationLink: `https://jobverify.test/verify-email?next=evil#token=${token}` },
  { ...verificationBody, verificationLink: `${verificationLink}&next=evil` },
  { ...verificationBody, verificationLink: 'https://jobverify.test/verify-email#token=short' },
  { ...verificationBody, to: 'first@gmail.com,second@gmail.com' },
  { ...verificationBody, html: 'custom HTML' },
]) {
  test(`verification relay rejects invalid payload ${JSON.stringify(invalid).slice(0, 100)}`, async t => {
    const { calls, env, handler } = fixture(t);
    assert.equal((await handler(verificationRequest(invalid), env)).status, 400);
    assert.equal(calls.transports.length, 0);
  });
}
