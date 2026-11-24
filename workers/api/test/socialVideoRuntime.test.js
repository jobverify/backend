import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { createCanvas } from '@napi-rs/canvas';
const modulePath = process.env.JOBVERIFY_WRANGLER_MODULE;
const { unstable_dev } = await import(modulePath ? pathToFileURL(modulePath).href : 'wrangler');

test('workerd streams native R2 bodies through the Express bridge with HEAD and byte ranges', { timeout: 90_000 }, async t => {
  const directory = new URL('../.wrangler/social-video-runtime-test/', import.meta.url); await fs.mkdir(directory, { recursive: true });
  const script = fileURLToPath(new URL('worker.js', directory)); const config = fileURLToPath(new URL('wrangler.json', directory));
  await build({ entryPoints: [fileURLToPath(new URL('./fixtures/socialVideo.worker.js', import.meta.url))], outfile: script, bundle: true, format: 'esm', platform: 'node', target: 'es2022', conditions: ['workerd', 'node'], mainFields: ['module', 'main'], external: ['node:*', 'cloudflare:*'], banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire('/worker.js');" } });
  await fs.writeFile(config, JSON.stringify({ name: 'jobverify-social-video-runtime-test', main: 'worker.js', compatibility_date: '2026-11-10', compatibility_flags: ['nodejs_compat'], r2_buckets: [{ binding: 'MEDIA', bucket_name: 'runtime-video' }], durable_objects: { bindings: [{ name: 'API', class_name: 'SocialVideoRuntimeTest' }] }, migrations: [{ tag: 'v1', new_sqlite_classes: ['SocialVideoRuntimeTest'] }] }));
  const worker = await unstable_dev(script, { config, local: true, ip: '127.0.0.1', port: 18915, bundle: false, persist: false, logLevel: 'error', envFiles: [], experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false } }); t.after(() => worker.stop());
  const size = 4 * 1024 ** 2 + 97;
  const response = await worker.fetch('/movie', { signal: AbortSignal.timeout(45_000) }); assert.equal(response.status, 200); assert.equal(response.headers.get('content-length'), String(size)); assert.equal(response.headers.get('x-jobverify-asset-length'), null);
  let received = 0;
  for await (const chunk of response.body) { for (const value of chunk) assert.equal(value, received++ % 251); }
  assert.equal(received, size);
  const head = await worker.fetch('/movie', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(size)); assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const [range, start, length] of [['bytes=1024-2047', 1024, 1024], ['bytes=-97', size - 97, 97], [`bytes=${size - 97}-`, size - 97, 97]]) {
    const partial = await worker.fetch('/movie', { headers: { range } }); assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), `bytes ${start}-${start + length - 1}/${size}`);
    const bytes = new Uint8Array(await partial.arrayBuffer()); assert.equal(bytes.length, length); for (let i = 0; i < length; i++) assert.equal(bytes[i], (start + i) % 251);
  }
  assert.equal((await worker.fetch('/movie', { headers: { range: `bytes=${size}-` } })).status, 416);
  // Exercise the pure-JS decoder inside workerd, not only its Node test suite.
  const jpeg = createCanvas(1080, 1920).toBuffer('image/jpeg');
  const valid = await worker.fetch('/cover', { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: jpeg });
  assert.equal(valid.status, 200); const cover = await valid.json(); assert.equal(cover.width, 1080); assert.equal(cover.height, 1920);
  let scan = 2;
  while (scan < jpeg.length) { const marker = jpeg[scan + 1]; scan += 2 + jpeg.readUInt16BE(scan + 2); if (marker === 0xda) break; }
  const truncated = Buffer.concat([jpeg.subarray(0, scan), Buffer.from([1, 255, 217])]);
  const invalid = await worker.fetch('/cover', { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: truncated });
  assert.equal(invalid.status, 400);

});
