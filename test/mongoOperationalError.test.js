import assert from 'node:assert/strict';
import test from 'node:test';
import { isMongoOperationalError, retryMongoOperation } from '../src/utils/mongoOperationalError.js';

test('database recovery distinguishes operational errors from query and programming defects', () => {
  for (const code of [91, 112, 251, 'ECONNRESET']) assert.equal(isMongoOperationalError(Object.assign(new Error(), { code })), true);
  for (const code of [2, 9, 66, 121, 11000]) assert.equal(isMongoOperationalError(Object.assign(new Error(), { code })), false);
  const cause = Object.assign(new Error('transaction aborted'), { code: 251 });
  assert.equal(isMongoOperationalError(new TypeError('invalid code', { cause })), false);
  assert.equal(isMongoOperationalError(new RangeError('invalid code', { cause })), false);
  assert.equal(isMongoOperationalError(new Error('outer', { cause })), true);
  cause.cause = cause;
  assert.equal(isMongoOperationalError(cause), true);
});

test('cancellation interrupts database backoff instead of replaying the operation', async () => {
  const controller = new AbortController();
  const reason = new Error('stop recovery');
  let attempts = 0;
  await assert.rejects(retryMongoOperation(async () => {
    attempts++;
    throw Object.assign(new Error('connection lost'), { name: 'MongoNetworkError' });
  }, { signal: controller.signal, wait: async () => controller.abort(reason) }), error => error === reason);
  assert.equal(attempts, 1);
});

test('unknown transaction commit results remain pending without application-level replay', async () => {
  const error = Object.assign(new Error('commit acknowledgement lost'), {
    name: 'MongoNetworkError', errorLabels: ['UnknownTransactionCommitResult'],
  });
  let calls = 0;
  assert.equal(isMongoOperationalError(error), true);
  await assert.rejects(retryMongoOperation(async () => { calls++; throw error; }, { wait: async () => {} }), actual => actual === error);
  assert.equal(calls, 1);
});
