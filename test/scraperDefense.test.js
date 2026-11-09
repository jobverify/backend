import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanaryHandler, createCrawlerPolicyGuard } from '../src/security/scraperDefense.js';

function response() {
  return { statusCode: 200, headers: {}, set(name, value) { this.headers[name.toLowerCase()] = String(value); return this; },
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { this.ended = true; return this; } };
}

test('training crawler policy rejects harvesting agents while Google and ordinary visitors retain access', () => {
  for (const ua of ['GPTBot/1.0', 'ClaudeBot/1.0', 'CCBot/2.0', 'Bytespider']) {
    const res = response();
    createCrawlerPolicyGuard()({ headers: { 'user-agent': ua } }, res, () => assert.fail('harvester passed'));
    assert.equal(res.statusCode, 403);
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  for (const ua of ['Googlebot/2.1', 'AdsBot-Google', 'OAI-SearchBot', 'Mozilla/5.0', '']) {
    let passed = false;
    const res = response();
    createCrawlerPolicyGuard()({ headers: { 'user-agent': ua } }, res, () => { passed = true; });
    assert.equal(passed, true);
    assert.match(res.headers.link, /_canary/);
  }
});

test('canary chain terminates after three links and never exposes real content', () => {
  const handler = createCanaryHandler();
  for (let step = 0; step <= 3; step++) {
    const res = response();
    handler({ method: 'GET', path: `/${step}` }, res);
    assert.match(res.headers['x-robots-tag'], /noindex/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.statusCode, step === 3 ? 410 : 200);
    assert.equal(res.body.synthetic, true);
    assert.equal(res.body.next, step === 3 ? null : `/api/_canary/${step + 1}`);
  }
});

test('decoy budgets count HEAD requests, expire, and bound malformed depth requests', () => {
  let time = 10;
  const handler = createCanaryHandler({ now: () => time, limit: 2, windowMs: 60_000 });
  const head = response();
  handler({ method: 'HEAD', path: '/0' }, head);
  assert.equal(head.ended, true);
  assert.equal(head.body, undefined);
  const invalid = response();
  handler({ method: 'GET', path: '/-1' }, invalid);
  assert.equal(invalid.statusCode, 400);
  const limited = response();
  handler({ method: 'GET', path: '/0' }, limited);
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.headers['retry-after'], '60');
  time += 60_000;
  const fresh = response();
  handler({ method: 'GET', path: '/0' }, fresh);
  assert.equal(fresh.statusCode, 200);
});
