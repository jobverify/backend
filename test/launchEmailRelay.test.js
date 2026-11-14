import assert from 'node:assert/strict';
import test from 'node:test';
import nodemailer from 'nodemailer';
import { sendEmailChangeVerificationEmail, sendPasswordResetEmail, sendVerificationEmail } from '../src/utils/sendEmail.js';
import { createRelayHandler } from '../workers/gmail-relay/src/relay.js';

const secret = 'launch-mail-test-secret-at-least-32-characters';
const token = 'a'.repeat(64);
const origin = 'https://jobverify.test';

function setup(t) {
  const original = { ...process.env };
  t.after(() => { process.env = original; });
  Object.assign(process.env, { EMAIL_RELAY_URL: 'https://relay.test', EMAIL_RELAY_SECRET: secret,
    SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '' });
  const messages = [];
  const handler = createRelayHandler({ createTransport: () => ({
    sendMail: async message => { messages.push(message); return { accepted: [message.to] }; }, close() {},
  }) });
  const env = { RELAY_SECRET: secret, GMAIL_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'test-app-password',
    FRONTEND_ORIGIN: origin, GLOBAL_LIMITER: { limit: async () => ({ success: true }) },
    RECIPIENT_LIMITER: { limit: async () => ({ success: true }) } };
  t.mock.method(nodemailer, 'createTransport', () => assert.fail('backend must not use SMTP when a relay is configured'));
  t.mock.method(globalThis, 'fetch', (url, options) => handler(new Request(url, options), env));
  return { messages, handler, env };
}

test('email-change delivery crosses the backend/Worker boundary with its verification mode intact', async t => {
  const { messages } = setup(t);
  const link = `${origin}/verify-email?mode=change#token=${token}`;
  assert.deepEqual(await sendEmailChangeVerificationEmail('new-owner@gmail.com', link), { accepted: ['new-owner@gmail.com'] });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].subject, 'Verify your new Jobverify email address');
  assert.equal(messages[0].to, 'new-owner@gmail.com');
  assert.ok(messages[0].text.includes(link));
  assert.ok(messages[0].html.includes(link));
});

test('registration and reset contracts still cross the same relay without SMTP credentials', async t => {
  const { messages } = setup(t);
  await sendVerificationEmail('owner@gmail.com', `${origin}/verify-email#token=${token}`);
  await sendPasswordResetEmail('owner@gmail.com', `${origin}/reset-password#token=${token}`);
  assert.deepEqual(messages.map(message => message.subject), ['Verify your Jobverify account', 'Reset your Jobverify password']);
});

test('email-change relay failure is safe and never falls back to SMTP', async t => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: `private ${secret} ${token}` }, { status: 503 }));
  await assert.rejects(sendEmailChangeVerificationEmail('owner@gmail.com', `${origin}/verify-email?mode=change#token=${token}`),
    { message: 'Email change verification email relay delivery failed.' });
});

test('the email-change endpoint rejects link confusion and arbitrary mail before provider access', async t => {
  const { messages, handler, env } = setup(t);
  for (const verificationLink of [
    `${origin}/verify-email#token=${token}`,
    `${origin}/verify-email?mode=register#token=${token}`,
    `${origin}/verify-email?mode=change&next=evil#token=${token}`,
    `${origin}/reset-password?mode=change#token=${token}`,
    `https://evil.test/verify-email?mode=change#token=${token}`,
  ]) {
    const response = await handler(new Request('https://relay.test/send-email-change', { method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'owner@gmail.com', verificationLink }) }), env);
    assert.equal(response.status, 400, verificationLink);
  }
  assert.equal(messages.length, 0);
});
