import assert from 'node:assert/strict';
import test from 'node:test';
import * as workerHttp from '../src/config.js';
import { runMaintenance } from '../src/maintenance.js';

const { forwardClientRequest, validateWorkerConfiguration } = workerHttp;

const environment = () => ({
  NODE_ENV: 'production', TRUST_PROXY: '1',
  TURNSTILE_SECRET_KEY: 'local-test', TURNSTILE_ALLOWED_HOSTNAMES: 'www.jobverify.in', TURNSTILE_EXPECTED_ACTION: 'login',
  PIPELINE_LOCAL_ENABLED: 'false', JOB_VERIFICATION_ENABLED: 'false', AUTO_APPLY_ENABLED: 'false',
  MONGO_URI: 'mongodb+srv://test:test@example.test/jobverify', JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGIN: 'https://www.jobverify.in', FRONTEND_ORIGIN: 'https://www.jobverify.in',
  PUBLIC_API_ORIGIN: 'https://api.jobverify.in', EMAIL_RELAY_URL: 'https://relay.example.test', EMAIL_RELAY_SECRET: 'y'.repeat(32),
});
const store = () => {
  const values = new Map();
  return { get: async key => values.get(key), put: async (key, value) => values.set(key, value) };
};

test('Worker rejects missing secrets and Node execution features', () => {
  assert.doesNotThrow(() => validateWorkerConfiguration(environment()));
  for (const key of ['PIPELINE_LOCAL_ENABLED', 'JOB_VERIFICATION_ENABLED', 'AUTO_APPLY_ENABLED']) {
    assert.throws(() => validateWorkerConfiguration({ ...environment(), [key]: 'true' }), new RegExp(key));
  }
  assert.throws(() => validateWorkerConfiguration({ ...environment(), JWT_SECRET: '' }), /JWT_SECRET/);
  assert.throws(() => validateWorkerConfiguration({ ...environment(), EMAIL_RELAY_URL: 'http://relay.example.test' }), /HTTPS/);
});

test('internal forwarding replaces spoofed proxy chains and preserves request body/cookies', async () => {
  const request = new Request('https://api.jobverify.in/api/auth/login', {
    method: 'POST', body: '{"email":"test@example.test"}',
    headers: { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '1.1.1.1, 2.2.2.2',
      'X-Forwarded-Proto': 'http', 'Forwarded': 'for=1.1.1.1', 'X-Forwarded-Host': 'attacker.test', Cookie: 'csrf=test' },
  });
  const forwarded = forwardClientRequest(request);
  assert.equal(forwarded.headers.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(forwarded.headers.get('x-forwarded-proto'), 'https');
  assert.equal(forwarded.headers.get('forwarded'), null);
  assert.equal(forwarded.headers.get('x-forwarded-host'), null);
  assert.equal(forwarded.headers.get('cookie'), 'csrf=test');
  assert.equal(await forwarded.text(), '{"email":"test@example.test"}');
});

test('public HTTP redirects preserve the URL and POST body without trusting forwarding headers', () => {
  for (const hostname of ['api.jobverify.in', 'backend.jobverify.workers.dev']) {
    const request = new Request(`http://${hostname}/api/auth/reset-password?token=local-test`, {
      method: 'POST', body: '{"password":"local-test-only"}',
      headers: { 'X-Forwarded-Host': 'attacker.example', 'X-Forwarded-Proto': 'https' },
    });
    const response = workerHttp.redirectInsecureRequest?.(request);
    assert.equal(response?.status, 308);
    assert.equal(response.headers.get('location'), `https://${hostname}/api/auth/reset-password?token=local-test`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(request.bodyUsed, false);
  }
});

test('HTTPS requests and loopback development do not redirect', () => {
  for (const url of ['https://api.jobverify.in/health', 'http://localhost:18913/health',
    'http://127.0.0.1:18913/health', 'http://[::1]:18913/health']) {
    assert.equal(workerHttp.redirectInsecureRequest?.(new Request(url)), null);
  }
});

test('outage responses retain safe credentialed CORS and security headers for the frontend', async () => {
  const request = new Request('https://api.jobverify.in/api/site-settings', {
    headers: { Origin: 'https://www.jobverify.in', Cookie: 'session=local-test-secret' },
  });
  const response = workerHttp.createUnavailableResponse?.(request, environment());
  assert.equal(response?.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '30');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://www.jobverify.in');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(response.headers.get('access-control-expose-headers'), 'Retry-After');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(response.headers.get('strict-transport-security'), /max-age=/);
  assert.deepEqual(await response.json(), { success: false, message: 'The API is temporarily unavailable.' });
});

test('outage responses never grant CORS to untrusted or absent origins', () => {
  for (const origin of ['https://attacker.example', 'https://www.jobverify.in.attacker.example', undefined]) {
    const request = new Request('https://api.jobverify.in/ready', { headers: origin ? { Origin: origin } : {} });
    const response = workerHttp.createUnavailableResponse?.(request, environment());
    assert.equal(response?.status, 503);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  }
});

test('maintenance deduplicates minute ticks and runs hourly tasks only once per hour', async () => {
  const storage = store();
  const calls = [];
  const tasks = [{ name: 'minute', run: async () => calls.push('minute') },
    { name: 'hourly', everyMinutes: 60, run: async () => calls.push('hourly') }];
  await runMaintenance({ tasks, storage, scheduledTime: 60_000 });
  await runMaintenance({ tasks, storage, scheduledTime: 60_000 });
  await runMaintenance({ tasks, storage, scheduledTime: 120_000 });
  assert.deepEqual(calls, ['minute', 'hourly', 'minute']);
  await runMaintenance({ tasks, storage, scheduledTime: 3600_000 });
  assert.deepEqual(calls, ['minute', 'hourly', 'minute', 'minute', 'hourly']);
});

test('failed maintenance retains its retry slot and does not block other tasks', async t => {
  t.mock.method(console, 'error', () => {});
  const storage = store(); let fail = true; let healthy = 0;
  const tasks = [{ name: 'retry', run: async () => { if (fail) throw new Error('private provider details'); } },
    { name: 'healthy', run: async () => { healthy++; } }];
  await assert.rejects(runMaintenance({ tasks, storage, scheduledTime: 60_000 }), /^Error: Maintenance tasks failed: retry$/);
  assert.equal(await storage.get('maintenance:retry'), undefined);
  fail = false;
  await runMaintenance({ tasks, storage, scheduledTime: 60_000 });
  assert.equal(healthy, 1);
  assert.equal(await storage.get('maintenance:retry'), 1);
});

test('maintenance stops starting tasks after its time budget', async () => {
  let time = 0; let second = false;
  await assert.rejects(runMaintenance({ storage: store(), scheduledTime: 60_000, now: () => time, budgetMs: 10,
    tasks: [{ name: 'first', run: async () => { time = 20; } }, { name: 'second', run: async () => { second = true; } }],
  }), /budget exhausted/);
  assert.equal(second, false);
});
