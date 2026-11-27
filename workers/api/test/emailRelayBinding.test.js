import assert from 'node:assert/strict';
import test from 'node:test';
import * as email from '../adapters/sendEmail.js';

test('Worker email delivery uses its service binding for every email type', async t => {
  t.mock.method(globalThis, 'fetch', async () => { assert.fail('Must not fetch a sibling workers.dev URL publicly'); });
  for (const [key, value] of Object.entries({ EMAIL_RELAY_URL: 'https://relay.example', EMAIL_RELAY_SECRET: 'a'.repeat(32) })) {
    const before = process.env[key]; process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const requests = [];
  assert.equal(typeof email.bindEmailRelay, 'function');
  email.bindEmailRelay({ async fetch(url, options) {
    requests.push({ path: new URL(url).pathname, authorization: options.headers.Authorization, body: JSON.parse(options.body) });
    return Response.json({ success: true });
  } });
  const link = 'https://www.jobverify.in/reset-password#token=' + 'b'.repeat(64);
  for (const send of [email.sendPasswordResetEmail, email.sendVerificationEmail, email.sendEmailChangeVerificationEmail]) {
    assert.deepEqual(await send('owner@gmail.com', link), { accepted: ['owner@gmail.com'] });
  }
  assert.deepEqual(requests.map(x => x.path), ['/send-password-reset', '/send-verification', '/send-email-change']);
  assert.ok(requests.every(x => x.authorization === 'Bearer ' + 'a'.repeat(32)));
});
