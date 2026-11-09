import assert from 'node:assert/strict';
import test from 'node:test';

test('retired contact and campaign endpoints are absent while resume tailoring remains private', async t => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.JWT_SECRET = 'retired-feature-http-test-secret-at-least-32-characters';
  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/api/user/outreach/threads', '/api/user/outreach/discoveries', '/api/user/campaigns', '/api/user/gmail', '/api/user/gmail/callback', '/api/user/application-mail', '/api/user/application-mail/messages', '/api/user/application-mail/choices']) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  for (const [method, route] of [['POST', '/api/user/application-mail/connect'], ['POST', '/api/user/application-mail/sync'], ['DELETE', '/api/user/application-mail'], ['PUT', '/api/user/application-mail/messages/receipt']]) {
    assert.equal((await fetch(base + route, { method, headers: { origin: 'http://localhost:5173', cookie: 'jobverify_csrf=retired-feature-token', 'x-csrf-token': 'retired-feature-token' } })).status, 404, `${method} ${route}`);
  }
  assert.equal((await fetch(base + '/api/user/tailored-resumes')).status, 401);
  assert.equal((await fetch(base + '/api/user/resume')).status, 401);
});
