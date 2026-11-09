import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { requestDiagnostics } from '../src/middleware/requestDiagnostics.js';
import { logOperationalError } from '../src/utils/operationalLog.js';

test('requests get independent IDs and emit route timing without query strings or credentials', t => {
  const logs = [];
  t.mock.method(console, 'log', value => logs.push(JSON.parse(value)));
  const first = { method: 'GET', originalUrl: '/jobs?token=private-token', headers: { authorization: 'Bearer private-token' }, route: { path: '/jobs/:id' } };
  const second = { method: 'GET' };
  const response = () => Object.assign(new EventEmitter(), { statusCode: 200, set(name, value) { this[name] = value; } });
  const res = response();
  requestDiagnostics(first, res, () => {});
  requestDiagnostics(second, response(), () => {});
  res.emit('finish');
  assert.notEqual(first.requestId, second.requestId);
  assert.equal(res['X-Request-ID'], first.requestId);
  assert.equal(logs[0].requestId, first.requestId);
  assert.equal(logs[0].route, '/jobs/:id');
  assert.ok(logs[0].durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(logs), /private-token|authorization|originalUrl/);
});

test('operational errors retain categorical causes and correlation without raw error data', t => {
  const logs = [];
  t.mock.method(console, 'error', value => logs.push(JSON.parse(value)));
  const error = Object.assign(new Error('mongodb://user:private-password@host'), {
    code: 11000, cause: new TypeError('private-token'), details: { password: 'private-password' },
  });
  logOperationalError('queue_recovery', error, { requestId: 'fixture-request', statusCode: 503 });
  assert.equal(logs[0].errorType, 'Error');
  assert.equal(logs[0].causeType, 'TypeError');
  assert.equal(logs[0].errorCode, 11000);
  assert.equal(logs[0].requestId, 'fixture-request');
  assert.doesNotMatch(JSON.stringify(logs), /private-password|private-token|mongodb/);
});
