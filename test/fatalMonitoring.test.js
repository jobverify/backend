import assert from 'node:assert/strict';
import test from 'node:test';
import { createFatalErrorHandler } from '../src/monitoring/fatalError.js';

test('fatal reporting captures the original error and waits for delivery before exit 1', async () => {
  const original = new Error('synthetic private detail');
  const events = [];
  let completeFlush;
  const fail = createFatalErrorHandler({
    capture: error => events.push(error),
    flush: () => new Promise(resolve => { completeFlush = resolve; }),
    exit: code => events.push(code), timeoutMs: 1000,
  });
  const pending = fail(original);
  await Promise.resolve();
  assert.deepEqual(events, [original]);
  completeFlush(true);
  await pending;
  assert.deepEqual(events, [original, 1]);
});

test('an unavailable or stuck monitor cannot prevent a bounded fatal exit', { timeout: 1000 }, async () => {
  for (const flush of [async () => { throw new Error('offline'); }, () => new Promise(() => {})]) {
    const exits = [];
    const fail = createFatalErrorHandler({ capture: () => {}, flush, exit: code => exits.push(code), timeoutMs: 5 });
    await fail(new Error('fixture'));
    assert.deepEqual(exits, [1]);
  }
});
