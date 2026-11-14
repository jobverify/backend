import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { sanitizeErrorEvent, observeLoginFailures } from '../src/monitoring/errorEvents.js';

test('error reporting keeps stack locations while removing all captured personal data', () => {
  const secret = 'private-fixture-must-never-leave';
  const event = sanitizeErrorEvent({
    event_id: 'a'.repeat(32), level: 'error', platform: 'node',
    message: secret, user: { email: secret }, request: { cookies: secret },
    breadcrumbs: [{ message: secret }], extra: { secret }, contexts: { secret },
    exception: { values: [{ type: 'TypeError', value: secret, stacktrace: { frames: [{
      filename: 'https://example.test/assets/app.js?token=' + secret,
      function: 'loadJobs', lineno: 24, colno: 7, vars: { secret }, pre_context: [secret],
    }] } }] },
  });
  assert.ok(!JSON.stringify(event).includes(secret));
  const frame = event.exception.values[0].stacktrace.frames[0];
  assert.equal(frame.filename, 'https://example.test/assets/app.js');
  assert.equal(frame.lineno, 24);
  assert.equal(frame.colno, 7);
  assert.equal(frame.function, 'loadJobs');
  assert.equal(event.exception.values[0].type, 'TypeError');
  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
});

test('failed-login events use a fixed message and contain no submitted identity', () => {
  const event = sanitizeErrorEvent({ message: 'person@example.test',
    tags: { security_event: 'auth.login_failed', email: 'person@example.test', auth_method: 'password' } });
  assert.equal(event.message, 'Authentication attempt rejected');
  assert.equal(event.tags.security_event, 'auth.login_failed');
  assert.ok(!JSON.stringify(event).includes('person@example.test'));
});

test('login observer reports rejected sign-ins after response completion and leaves other requests alone', () => {
  for (const [path, method, status, expected] of [
    ['/login', 'POST', 401, 1], ['/google', 'POST', 403, 1], ['/login', 'POST', 429, 1],
    ['/login', 'POST', 200, 0], ['/forgot-password', 'POST', 401, 0], ['/login', 'GET', 401, 0],
  ]) {
    const events = [];
    const res = new EventEmitter();
    res.statusCode = status;
    let nextCalls = 0;
    observeLoginFailures(event => events.push(event))({ path, method, body: { email: 'private' } }, res, () => nextCalls++);
    assert.equal(nextCalls, 1);
    assert.equal(events.length, 0);
    res.emit('finish');
    assert.equal(events.length, expected, path + ':' + method + ':' + status);
    assert.ok(!JSON.stringify(events).includes('private'));
  }
});

test('monitoring failures cannot change an authentication response', () => {
  const res = new EventEmitter();
  res.statusCode = 401;
  observeLoginFailures(() => { throw new Error('monitor offline'); })({ path: '/login', method: 'POST' }, res, () => {});
  assert.doesNotThrow(() => res.emit('finish'));
});

test('login reporting retains its auth method when Express restores the mounted request path', () => {
  const methods = [];
  const req = { method: 'POST', path: '/google' };
  const res = new EventEmitter();
  res.statusCode = 401;
  observeLoginFailures(method => methods.push(method))(req, res, () => {});
  req.path = '/api/auth/google';
  res.emit('finish');
  assert.deepEqual(methods, ['google']);
});
