import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { fetchVerifiedHttpsPage } from '../utils/verifiedHttps.js';

const origin = 'https://example.test';
const fixtureRequest = (pages, calls) => (url, options, callback) => {
  calls.push({ url, options });
  const req = new EventEmitter();
  req.destroy = () => {};
  req.end = () => {
    const page = pages.shift();
    if (page.error) { req.emit('error', page.error); return; }
    const res = new EventEmitter();
    res.headers = page.headers ?? {}; res.statusCode = page.status ?? 200;
    res.destroy = () => {};
    callback(res);
    for (const chunk of page.chunks ?? ['ok']) res.emit('data', chunk);
    res.emit('end');
  };
  return req;
};
test('strict TLS and allowed origins apply to every redirect hop', async () => {
  const calls = [];
  const page = await fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin],
    request: fixtureRequest([{ status: 302, headers: { location: '/next' } }, {}], calls) });
  assert.equal(page.html, 'ok'); assert.equal(page.url, `${origin}/next`);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.rejectUnauthorized === true));
  for (const location of ['http://example.test/', 'https://evil.test/', 'https://example.test:8443/', 'https://user:pass@example.test/']) {
    const refused = [];
    await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin],
      request: fixtureRequest([{ status: 302, headers: { location } }], refused) }), /verified origins/);
    assert.equal(refused.length, 1);
  }
});
test('certificate error after a redirect propagates without retry', async () => {
  const calls = [];
  const error = Object.assign(new Error('expired certificate'), { code: 'CERT_HAS_EXPIRED' });
  await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin],
    request: fixtureRequest([{ status: 301, headers: { location: '/next' } }, { error }], calls) }), e => e === error);
  assert.equal(calls.length, 2);
});
test('body sizes, redirect loops, aborts and wall-clock time are bounded', async () => {
  await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin], maxBytes: 3,
    request: fixtureRequest([{ chunks: ['ab', 'cd'] }], []) }), /byte limit/);
  await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin], maxRedirects: 1,
    request: fixtureRequest(Array.from({ length: 2 }, () => ({ status: 302, headers: { location: '/' } })), []) }), /redirect limit/);
  await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin], signal: AbortSignal.abort(),
    request: () => assert.fail('aborted request must not start') }));
  await assert.rejects(fetchVerifiedHttpsPage(origin, { allowedOrigins: [origin], timeoutMs: 20,
    request: () => ({ on() {}, end() {}, destroy() {} }) }), /deadline/);
});
