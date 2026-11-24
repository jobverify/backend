import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import BlacklistedToken from '../src/models/BlacklistedToken.js';
import SiteSettings from '../src/models/SiteSettings.js';
import RateLimitBucket from '../src/models/RateLimitBucket.js';
import Job from '../src/models/Job.js';

Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'assistant-api-tests-only-secret-at-least-32-characters',
  CORS_ORIGIN: 'https://app.jobverify.test', JOB_VERIFICATION_ENABLED: 'false' });
const { createApp } = await import('../src/app.js');

async function fixture(t, { model, billingEnabled = false } = {}) {
  const member = { _id: '507f1f77bcf86cd799439011', isVerified: true, sessionVersion: 0, role: 'user' };
  t.mock.method(User, 'findById', () => ({ select: async () => member }));
  t.mock.method(BlacklistedToken, 'findOne', async () => null);
  const settings = { billingEnabled, experiencedJobsEnabled: true, assistantEnabled: true };
  t.mock.method(SiteSettings, 'findById', () => ({ lean: async () => settings }));
  const counts = new Map();
  t.mock.method(RateLimitBucket, 'findOneAndUpdate', async filter => {
    counts.set(filter._id, (counts.get(filter._id) || 0) + 1);
    return { count: counts.get(filter._id) };
  });
  const app = createApp({ assistantModel: model });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = 'http://127.0.0.1:' + server.address().port;
  const csrfResponse = await fetch(base + '/api/auth/csrf-token');
  const csrf = await csrfResponse.json();
  const cookie = csrfResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const token = csrf.token;
  const headers = { authorization: 'Bearer ' + jwt.sign({ id: member._id, sessionVersion: 0 }, process.env.JWT_SECRET),
    'content-type': 'application/json', origin: 'https://app.jobverify.test', cookie, 'x-csrf-token': token };
  return { member, settings, base, headers, counts, post: (body, extra = {}) => fetch(base + '/api/assistant/messages', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body), ...extra,
  }) };
}

test('assistant capabilities require a verified session and mutations require CSRF', async t => {
  let calls = 0;
  const state = await fixture(t, { model: async () => { calls++; return {}; } });
  const settings = await fetch(state.base + '/api/site-settings');
  assert.equal((await settings.json()).data.assistantEnabled, true);
  assert.equal((await fetch(state.base + '/api/assistant/capabilities')).status, 401);
  const caps = await fetch(state.base + '/api/assistant/capabilities', { headers: state.headers });
  assert.equal(caps.status, 200);
  assert.equal(caps.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await caps.json()).data, { enabled: true, verificationEnabled: false });
  state.member.isVerified = false;
  assert.equal((await fetch(state.base + '/api/assistant/capabilities', { headers: state.headers })).status, 401);
  state.member.isVerified = true;
  const noCsrf = { ...state.headers, 'x-csrf-token': '' };
  assert.equal((await state.post({ message: 'Hi' }, { headers: noCsrf })).status, 403);
  assert.equal(calls, 0);
});

test('global assistant setting blocks every member before quota and inference and can be re-enabled without restart', async t => {
  // An obsolete environment value must have no effect on the admin setting.
  const previous = process.env.ASSISTANT_ENABLED;
  process.env.ASSISTANT_ENABLED = 'false';
  t.after(() => { if (previous === undefined) delete process.env.ASSISTANT_ENABLED; else process.env.ASSISTANT_ENABLED = previous; });
  let calls = 0;
  const state = await fixture(t, { model: async () => { calls++; return {}; } });
  const capabilities = async () => (await (await fetch(state.base + '/api/assistant/capabilities', { headers: state.headers })).json()).data;
  assert.equal((await capabilities()).enabled, true);
  for (const setting of [false, undefined]) {
    state.settings.assistantEnabled = setting;
    assert.equal((await capabilities()).enabled, false);
    for (const id of ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']) {
      state.member._id = id;
      assert.equal((await state.post({ message: 'Help' })).status, 503);
    }
  }
  assert.equal(calls, 0);
  assert.equal(state.counts.size, 0);
  state.settings.assistantEnabled = true;
  assert.equal((await state.post({ message: 'Help' })).status, 200);
  assert.equal(calls, 1);
});

test('assistant validates before charging quota and counts actual request bytes', async t => {
  let calls = 0;
  const state = await fixture(t, { model: async () => {
    calls++; return { tool_calls: [{ name: 'lookup_help', arguments: { topic: 'contact' } }] };
  } });
  assert.equal((await state.post({ message: 'x', history: [{ role: 'tool', content: '{}' }] })).status, 400);
  const oversized = await state.post(' '.repeat(24 * 1024) + '{"message":"Hi"}');
  assert.equal(oversized.status, 413);
  assert.equal(state.counts.size, 0);
  const response = await state.post({ message: 'private-marker-in-a-question' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).data.sources[0].href, '/contact');
  assert.equal(calls, 1);
});

test('assistant returns Premium denial as a successful reply and exposes quota retry timing in JSON', async t => {
  let calls = 0;
  let quota = false;
  const state = await fixture(t, { billingEnabled: true, model: async () => {
    calls++;
    if (quota) throw Object.assign(new Error('3036: private prompt marker'), { code: 3036 });
    return { tool_calls: [{ name: 'search_jobs', arguments: { query: 'Python' } }] };
  } });
  t.mock.method(Job, 'aggregate', () => { throw new Error('Premium denial must happen before querying'); });
  const denied = await state.post({ message: 'Find Python jobs' });
  assert.equal(denied.status, 200);
  assert.equal((await denied.json()).data.actions[0].href, '/jobs?plans=1');
  assert.equal(calls, 1);
  quota = true;
  const exhausted = await state.post({ message: 'Help me' });
  const payload = await exhausted.json();
  assert.equal(exhausted.status, 429);
  assert.equal(payload.error, 'assistant_quota_exhausted');
  assert.ok(payload.retryAfterSeconds > 0);
  assert.equal(exhausted.headers.get('retry-after'), String(payload.retryAfterSeconds));
  assert.ok(!JSON.stringify(payload).includes('private prompt'));
  assert.equal(calls, 2);
});

test('Node startup without an AI binding keeps the optional assistant disabled', async t => {
  const state = await fixture(t);
  const response = await fetch(state.base + '/api/assistant/capabilities', { headers: state.headers });
  assert.deepEqual((await response.json()).data, { enabled: false, verificationEnabled: false });
  assert.equal((await state.post({ message: 'Hi' })).status, 503);
  assert.equal(state.counts.size, 0);
});
