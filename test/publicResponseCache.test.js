import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicResponseCache } from '../src/utils/publicResponseCache.js';

test('public cache shares in-flight requests and expires after completion', async () => {
  let now = 0, reads = 0, release;
  const cached = createPublicResponseCache({ ttlMs: 30, maxEntries: 2, now: () => now });
  const load = () => { reads++; return new Promise(resolve => { release = resolve; }); };
  const first = cached('all', load), second = cached('all', load);
  await Promise.resolve();
  assert.equal(reads, 1);
  release({ total: 5 });
  assert.deepEqual(await first, { total: 5 });
  assert.deepEqual(await second, { total: 5 });
  now = 29;
  assert.deepEqual(await cached('all', () => assert.fail('fresh entry must be reused')), { total: 5 });
  now = 30;
  assert.deepEqual(await cached('all', async () => ({ total: 6 })), { total: 6 });
});

test('public cache separates visibility keys and does not retain failures', async () => {
  const cached = createPublicResponseCache();
  assert.equal(await cached('all', async () => 10), 10);
  assert.equal(await cached('early-career', async () => 4), 4);
  await assert.rejects(cached('failed', async () => { throw new Error('offline'); }), /offline/);
  assert.equal(await cached('failed', async () => 8), 8);
});

test('public cache bounds retained keys without evicting in-flight work', async () => {
  const cached = createPublicResponseCache({ maxEntries: 1 });
  let release;
  const pending = cached('pending', () => new Promise(resolve => { release = resolve; }));
  await Promise.resolve();
  assert.equal(await cached('overflow', async () => 2), 2);
  const same = cached('pending', () => assert.fail('pending request must remain coalesced'));
  release(1);
  assert.equal(await pending, 1);
  assert.equal(await same, 1);
  await cached('replacement', async () => 3);
  assert.equal(await cached('pending', async () => 4), 4);
});
