import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordSafety, PasswordSafetyError } from '../src/services/passwordSafety.js';

const candidate = 'Password123!';
// Independently calculated SHA-1 for this public test password.
const suffix = 'F5F70D47ADC2DB2EB397FBEF5F7BC560E29';
const clean = () => new Response('0'.repeat(35) + ':0\r\n');

test('screening rejects a compromised password using only a five-character hash prefix', async () => {
  let request;
  const safety = createPasswordSafety({ fetchImpl: async (...args) => {
    request = args;
    return new Response(suffix + ':42\r\n' + '0'.repeat(35) + ':0\r\n');
  } });
  await assert.rejects(safety.check(candidate), error =>
    error instanceof PasswordSafetyError && error.statusCode === 400 && error.code === 'password_compromised');
  assert.equal(request[0], 'https://api.pwnedpasswords.com/range/49EFE');
  assert.equal(request[1].headers['Add-Padding'], 'true');
  assert.equal(request[1].redirect, 'error');
  assert.equal(JSON.stringify(request).includes(candidate), false);
  assert.equal(JSON.stringify(request).includes('49EFEF5F70D47ADC2DB2EB397FBEF5F7BC560E29'), false);
  assert.ok(request[1].signal instanceof AbortSignal);
});

test('matching zero-count padding does not reject a password', async () => {
  await createPasswordSafety({ fetchImpl: async () => new Response(
    suffix + ':0\r\n' + '1'.repeat(35) + ':7\r\n') }).check(candidate);
});

test('comparison uses complete case-insensitive suffixes', async () => {
  await createPasswordSafety({ fetchImpl: async () => new Response(
    'F5F70D47ADC2DB2EB397FBEF5F7BC560E28:1\r\n') }).check(candidate);
  await assert.rejects(createPasswordSafety({ fetchImpl: async () => new Response(
    'f5f70d47adc2db2eb397fbef5f7bc560e29:1\r\n') }).check(candidate), { code: 'password_compromised' });
});

for (const [name, response] of [
  ['HTTP failure', () => new Response('Unavailable', { status: 503 })],
  ['empty response', () => new Response('')],
  ['HTML response', () => new Response('<html>Unavailable</html>')],
  ['malformed record', () => new Response(suffix + ':not-a-count\r\n')],
  ['truncated hash', () => new Response('ABC:1\r\n')],
  ['oversized response', () => new Response('A'.repeat(128 * 1024 + 1))],
]) {
  test('screening fails closed on ' + name, async () => {
    const safety = createPasswordSafety({ fetchImpl: async () => response() });
    await assert.rejects(safety.check(candidate), error =>
      error instanceof PasswordSafetyError && error.statusCode === 503 && error.code === 'password_check_unavailable');
  });
}

test('network diagnostics are replaced with a safe retryable error', async () => {
  const safety = createPasswordSafety({ fetchImpl: async () => { throw new Error('provider diagnostic: ' + candidate); } });
  await assert.rejects(safety.check(candidate), error => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.message.includes(candidate), false);
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('the deadline includes a stalled response body', async () => {
  let cancelled = false;
  const safety = createPasswordSafety({ timeoutMs: 20, fetchImpl: async () => new Response(
    new ReadableStream({ cancel() { cancelled = true; } })) });
  await assert.rejects(safety.check(candidate), { code: 'password_check_unavailable' });
  assert.equal(cancelled, true);
});

test('an ordinary nonmatching range permits the password', async () => {
  await createPasswordSafety({ fetchImpl: async () => clean() }).check('Canary-Violet9!River');
});
