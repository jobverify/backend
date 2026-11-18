import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Uses workerd, not Node's HTTP server. A fake, unreachable Mongo URI proves
// startup/preflight work without Atlas and DB failures do not leak credentials.
const modulePath = process.env.JOBVERIFY_WRANGLER_MODULE;
const { unstable_dev } = await import(modulePath ? pathToFileURL(modulePath).href : 'wrangler');

test('Cloudflare runtime boots the real API and handles unavailable MongoDB safely', { timeout: 90_000 }, async t => {
  const worker = await unstable_dev(fileURLToPath(new URL('../dist/worker.js', import.meta.url)), {
    config: fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)),
    local: true, ip: '127.0.0.1', port: 18913, bundle: false,
    persist: false, logLevel: 'error', envFiles: [],
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
    vars: {
      MONGO_URI: 'mongodb://runtime-test-user:runtime-test-password@127.0.0.1:1/test?tls=true',
      JWT_SECRET: 'runtime-test-only-secret-at-least-32-characters',
      EMAIL_RELAY_URL: 'https://relay.example.test', EMAIL_RELAY_SECRET: 'runtime-test-relay-secret-at-least-32-characters',
      TURNSTILE_SECRET_KEY: 'local-test', TURNSTILE_ALLOWED_HOSTNAMES: 'www.jobverify.in', TURNSTILE_EXPECTED_ACTION: 'login',
    },
  });
  t.after(() => worker.stop());

  const health = await worker.fetch('/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');

  const preflight = await worker.fetch('/api/site-settings', {
    method: 'OPTIONS', headers: { Origin: 'https://www.jobverify.in', 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://www.jobverify.in');
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');

  const untrusted = await worker.fetch('/api/site-settings', {
    method: 'OPTIONS', headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(untrusted.headers.get('access-control-allow-origin'), null);

  const unavailable = await worker.fetch('/api/site-settings');
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  assert.equal((await unavailable.json()).message, 'The API is temporarily unavailable.');
});

test('Cloudflare streams a ZIP through private file fetching and Express', { timeout: 90_000 }, async t => {
  const started = Date.now();
  const payloadBytes = 4 * 1024 ** 2;
  // Use an actual HTTP response body, matching GitHub's native byte streams.
  // A synthetic JavaScript stream exercises a different pumping path.
  const upstream = createServer((request, response) => {
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': payloadBytes });
    const chunk = Buffer.alloc(65_536, 120);
    const source = Readable.from((function* () { for (let i = 0; i < payloadBytes / chunk.length; i++) yield chunk; })(), { objectMode: false });
    void pipeline(source, response).catch(() => response.destroy());
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); return new Promise(resolve => upstream.close(resolve)); });
  const fixture = new URL('./fixtures/pipelineDownload.worker.js', import.meta.url);
  const directory = new URL('../.wrangler/download-runtime-test/', import.meta.url);
  await fs.mkdir(directory, { recursive: true });
  const script = fileURLToPath(new URL('worker.js', directory));
  const config = fileURLToPath(new URL('wrangler.json', directory));
  await build({
    entryPoints: [fileURLToPath(fixture)], outfile: script, bundle: true, format: 'esm', platform: 'node', target: 'es2022',
    conditions: ['workerd', 'node'], mainFields: ['module', 'main'], external: ['node:*', 'cloudflare:*'],
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire('/worker.js');" },
  });
  await fs.writeFile(config, JSON.stringify({
    name: 'jobverify-download-runtime-test', main: 'worker.js', compatibility_date: '2026-11-10',
    compatibility_flags: ['nodejs_compat'],
    vars: { DOWNLOAD_TEST_ORIGIN: `http://127.0.0.1:${upstream.address().port}` },
    durable_objects: { bindings: [{ name: 'DOWNLOAD', class_name: 'DownloadRuntimeTest' }] },
    migrations: [{ tag: 'v1', new_sqlite_classes: ['DownloadRuntimeTest'] }],
  }));
  const worker = await unstable_dev(script, {
    config, local: true, ip: '127.0.0.1', port: 18914, bundle: false, persist: false, logLevel: 'error', envFiles: [],
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false },
  });
  t.after(() => worker.stop());
  console.info('Download runtime ready after', Date.now() - started, 'ms');
  assert.equal((await worker.fetch('/__jobverify_pipeline_file')).status, 404);
  const response = await worker.fetch('/download', { signal: AbortSignal.timeout(60_000) });
  console.info('Download runtime response', response.status, 'after', Date.now() - started, 'ms');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/zip/);
  let received = 0;
  let tail = Buffer.alloc(0);
  for await (const chunk of response.body) {
    if (!received) assert.equal(Buffer.from(chunk).readUInt32LE(), 0x04034b50);
    received += chunk.byteLength;
    tail = Buffer.concat([tail, chunk]).subarray(-8192);
  }
  console.info('Download runtime received', received, 'bytes after', Date.now() - started, 'ms');
  if (received < payloadBytes) {
    const begin = tail.indexOf(Buffer.from('{\n  "pipelineId":'));
    const end = tail.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), begin);
    console.info('Download manifest', tail.subarray(begin, end).toString());
  }
  assert.ok(received > payloadBytes, 'the whole payload must reach the client');
  assert.ok(received < payloadBytes + 8192);
  assert.match(tail.toString(), /"files":\s*\[\s*"rewrite\/logs.zip"\s*\]/);
  assert.match(tail.toString(), /"unavailable":\s*\[\]/);
  assert.equal(tail.readUInt32LE(tail.length - 22), 0x06054b50, 'the archive must have a complete ZIP directory');
});
