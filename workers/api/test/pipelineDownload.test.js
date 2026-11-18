import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createPipelineBundle } from '../adapters/pipelineDownload.js';
import * as downloads from '../adapters/pipelineDownload.js';

const run = {
  _id: '12345678-1234-1234-1234-123456789abc', target: 'github', repo: 'owner/repo', status: 'completed',
  stages: [
    { key: 'scraper', githubRunId: 71, status: 'completed' },
    { key: 'rewrite', githubRunId: 72, status: 'completed', summary: { rewritten: 3 } },
    { key: 'classification', githubRunId: 73, status: 'completed' },
  ],
};
const readBundle = async bundle => {
  const chunks = [];
  for await (const chunk of bundle.stream) chunks.push(chunk);
  return JSZip.loadAsync(Buffer.concat(chunks));
};

test('Worker downloads the selected stage with paginated artifacts and no token on storage requests', async t => {
  const inner = await new JSZip().file('output.txt', 'rewrite output').generateAsync({ type: 'nodebuffer' });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push(parsed.href);
    if (parsed.hostname === 'storage.example') {
      assert.equal(new Headers(options.headers).get('authorization'), null);
      return new Response(inner);
    }
    assert.equal(new Headers(options.headers).get('authorization'), 'Bearer test-pat');
    assert.equal(options.redirect, 'manual');
    assert.ok(parsed.pathname.includes('/runs/72/') || parsed.pathname.includes('/actions/artifacts/'));
    if (parsed.pathname.endsWith('/artifacts')) {
      const artifacts = parsed.searchParams.get('page') === '1'
        ? Array.from({ length: 100 }, (_, i) => ({ id: 72000 + i, name: i === 0 ? '../../unsafe' : 'expired', expired: i !== 0 }))
        : [{ id: 72100, name: 'last-page', expired: false }];
      return Response.json({ artifacts });
    }
    return new Response(null, { status: 302, headers: { Location: 'https://storage.example/signed.zip?secret=private' } });
  });
  const bundle = await createPipelineBundle(run, { token: 'test-pat', stage: 'rewrite' });
  t.after(bundle.cleanup);
  assert.ok(!calls.some(url => url.includes('storage.example')), 'file bodies must wait until the archive is consumed');
  const zip = await readBundle(bundle);
  assert.match(bundle.filename, /^rewrite-.*\.zip$/);
  assert.ok(zip.file('rewrite/logs.zip'));
  const innerZip = await JSZip.loadAsync(await zip.file('rewrite/logs.zip').async('nodebuffer'));
  assert.equal(await innerZip.file('output.txt').async('string'), 'rewrite output');
  assert.equal(Object.keys(zip.files).filter(name => name.startsWith('rewrite/artifacts/') && name.endsWith('.zip')).length, 2);
  assert.ok(!Object.keys(zip.files).some(name => name.includes('..') || name.startsWith('scraper/') || name.startsWith('classification/')));
  assert.deepEqual(JSON.parse(await zip.file('rewrite/stage-summary.json').async('string')), { rewritten: 3 });
  const manifestText = await zip.file('manifest.json').async('string');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.stages.length, 1);
  assert.equal(manifest.stages[0].files.length, 3);
  assert.equal(manifest.stages[0].unavailable.length, 99);
  assert.ok(!manifestText.includes('test-pat') && !manifestText.includes('signed.zip'));
});

for (const kind of ['logs', 'artifacts']) test(`Worker ${kind} archive fetches only the requested resource type`, async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (String(url).includes('/artifacts?')) return Response.json({ artifacts: [{ id: 99, name: 'output', expired: false }] });
    return new Response('test archive');
  });
  const bundle = await createPipelineBundle(run, { token: 'test-pat', kind, stage: 'rewrite' });
  t.after(bundle.cleanup);
  const zip = await readBundle(bundle);
  assert.equal(Boolean(zip.file('rewrite/logs.zip')), kind === 'logs');
  assert.equal(Boolean(zip.file('rewrite/artifacts/99-output.zip')), kind === 'artifacts');
  assert.equal(calls.some(url => url.endsWith('/logs')), kind === 'logs');
  assert.equal(calls.some(url => url.includes('/artifacts?')), kind === 'artifacts');
});

test('Worker archive preserves available summaries when GitHub resources fail or a stage has not started', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('private upstream body', { status: 410 }));
  const bundle = await createPipelineBundle({ ...run, status: 'running', stages: [run.stages[1], { key: 'classification', status: 'waiting' }] }, { token: 'test-pat' });
  t.after(bundle.cleanup);
  const zip = await readBundle(bundle);
  const text = await zip.file('manifest.json').async('string');
  const manifest = JSON.parse(text);
  assert.equal(manifest.snapshot, true);
  assert.ok(manifest.stages.every(stage => stage.unavailable.length > 0));
  assert.ok(zip.file('rewrite/stage-summary.json'));
  assert.ok(!text.includes('private upstream body'));
});

test('Worker archive validates resource selection and rejects unavailable local files', async () => {
  for (const options of [{ kind: 'invalid' }, { stage: '../rewrite' }]) {
    await assert.rejects(createPipelineBundle(run, { token: 'test-pat', ...options }), { status: 400 });
  }
  await assert.rejects(createPipelineBundle({ ...run, target: 'local' }, { token: 'test-pat' }), { status: 503 });
});

test('Worker archive aborts the current GitHub request when its reader disconnects', async t => {
  let started;
  const requested = new Promise(resolve => { started = resolve; });
  let remoteSignal;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    remoteSignal = options.signal;
    started();
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const bundle = await createPipelineBundle(run, { token: 'test-pat', kind: 'logs', stage: 'rewrite', signal: controller.signal });
  t.after(bundle.cleanup);
  const reading = readBundle(bundle);
  await requested;
  controller.abort();
  await assert.rejects(reading, { name: 'AbortError' });
  assert.equal(remoteSignal.aborted, true);
});

test('Worker includes every artifact when a sharded run needs more than 50 external requests', async t => {
  let fileCalls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/artifacts')) return Response.json({ artifacts: Array.from({ length: 68 }, (_, i) => ({ id: 100 + i, name: `shard-${i}`, expired: false })) });
    if (parsed.hostname === 'api.github.com') return new Response(null, { status: 302, headers: { Location: 'https://storage.example/archive.zip' } });
    return new Response('shard output');
  });
  downloads.bindPipelineDownloads({
    idFromName: () => 'download-object',
    get: () => ({ async fetch(request) {
      fileCalls++;
      assert.equal(new URL(request.url).hostname, 'pipeline-download.internal');
      return downloads.pipelineFileResponse(request, { token: 'test-pat' });
    } }),
  });
  t.after(() => downloads.bindPipelineDownloads(undefined));
  const bundle = await createPipelineBundle(run, { token: 'test-pat', stage: 'rewrite' });
  t.after(bundle.cleanup);
  const zip = await readBundle(bundle);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(fileCalls, 69);
  assert.equal(manifest.stages[0].files.length, 69);
  assert.deepEqual(manifest.stages[0].unavailable, []);
  assert.equal(await zip.file('rewrite/artifacts/167-shard-67.zip').async('string'), 'shard output');
});
