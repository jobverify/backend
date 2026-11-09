import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, rewriteCandidates } from '../rewriting/runner.js';
import { validateProseRewrite } from '../rewriting/prose.js';

const source = 'Build reliable Python services.';
const input = buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription: source });
const serverFor = async (t, complete = () => '<p>Invented duties.</p>') => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'quoted employer source' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests.push(body);
    const text = await complete(body, requests.length);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, requests };
};

test('adaptive corrections reduce repeated failing inference without accepting rejected text', async t => {
  const server = await serverFor(t);
  const client = createRewriteClient(server);
  const totals = { correctionRequests: 0, correctionsAccepted: 0, correctionsRejected: 0, correctionsSkipped: 0 };
  for (let i = 0; i < 20; i++) {
    const response = await client.generate(input, { cacheMode: 'refresh' });
    const checked = validateProseRewrite(response.value, input, 'stop');
    assert.equal(checked.ok, true);
    assert.equal(checked.description, source);
    assert.equal(checked.quality.sourceFallbackBlocks, 1);
    for (const key of Object.keys(totals)) totals[key] += response[key] || 0;
  }
  assert.equal(server.requests.length, 24, 'three initial corrections, eight skips, one probe, eight skips');
  assert.deepEqual(totals, { correctionRequests: 4, correctionsAccepted: 0, correctionsRejected: 4, correctionsSkipped: 16 });
});

test('always mode keeps the original one-correction opportunity on every rejected fragment', async t => {
  const server = await serverFor(t);
  const client = createRewriteClient({ ...server, correctionMode: 'always' });
  for (let i = 0; i < 12; i++) await client.generate(input, { cacheMode: 'refresh' });
  assert.equal(server.requests.length, 24);
});

test('a successful probe restores useful corrections after a cooldown', async t => {
  let corrections = 0;
  const server = await serverFor(t, body => body.seed === 42 && ++corrections > 3
    ? source.replace('Build', 'Develop') : '<p>Invented duties.</p>');
  const client = createRewriteClient(server);
  const responses = [];
  for (let i = 0; i < 14; i++) responses.push(await client.generate(input, { cacheMode: 'refresh' }));
  assert.equal(server.requests.length, 20);
  assert.equal(responses[11].correctionsAccepted, 1);
  assert.equal(responses[12].correctionsAccepted, 1);
  assert.equal(validateProseRewrite(responses[12].value, input, 'stop').quality.modelWordingEditedBlocks, 1);
});

test('strict callers retain a correction even when production correction attempts are cooling down', async t => {
  const server = await serverFor(t);
  const client = createRewriteClient(server);
  for (let i = 0; i < 3; i++) await client.generate(input, { cacheMode: 'refresh' });
  const response = await client.generate(input, { cacheMode: 'refresh', allowSourceFallback: false });
  assert.equal(response.generationRequests, 2);
  assert.equal(response.value, null);
  assert.equal(response.validationFailure.reason, 'unsafe_output');
  assert.equal(response.correctionsSkipped, 0);
});

test('shared inference charges a skipped correction to exactly one caller', async t => {
  const server = await serverFor(t);
  const client = createRewriteClient(server);
  for (let i = 0; i < 3; i++) await client.generate(input, { cacheMode: 'refresh' });
  const responses = await Promise.all(Array.from({ length: 3 }, () => client.generate(input)));
  assert.equal(responses.reduce((sum, r) => sum + r.generationRequests, 0), 1);
  assert.equal(responses.reduce((sum, r) => sum + (r.correctionsSkipped || 0), 0), 1);
});

test('correction counters survive the guarded publication boundary', async t => {
  const server = await serverFor(t);
  let result;
  await rewriteCandidates([{ _id: 'correction-metrics', title: 'Engineer', company: 'Example', sourceDescription: source,
    status: 'active', sourceContentHash: input.inputHash,
    descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async () => ({ matchedCount: 1 }), onResult: row => { result = row; },
  });
  assert.equal(result.correctionRequests, 1);
  assert.equal(result.correctionsRejected, 1);
  assert.equal(result.correctionsSkipped, 0);
});

test('invalid correction mode is rejected at configuration time', () => {
  assert.throws(() => createRewriteClient({ correctionMode: 'never' }), /correction/i);
});

test('a deadline during correction retains the inference cost without accepting an unfinished response', async t => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const server = await serverFor(t, async body => {
    if (body.seed === 42) { await blocked; return source; }
    return '<p>Invented duties.</p>';
  });
  t.after(() => release());
  await assert.rejects(createRewriteClient(server).generate(input, { remainingMs: 1000 }), error => {
    assert.equal(error.name, 'TimeoutError');
    assert.equal(error.generationRequests, 2);
    assert.equal(error.correctionRequests, 1);
    assert.equal(error.correctionsAccepted, 0);
    return true;
  });
});

test('disk caches keep adaptive and always correction modes separate', async t => {
  const prefix = path.join(os.tmpdir(), 'rewrite-correction-cache-');
  const directory = await fs.mkdtemp(prefix);
  t.after(() => { assert.ok(directory.startsWith(prefix)); return fs.rm(directory, { recursive: true, force: true }); });
  const server = await serverFor(t, () => source.replace('Build', 'Develop'));
  const adaptive = await createRewriteClient({ ...server, planCacheDir: directory }).generate(input);
  const always = await createRewriteClient({ ...server, planCacheDir: directory, correctionMode: 'always' }).generate(input);
  assert.equal(adaptive.generationRequests, 1);
  assert.equal(always.generationRequests, 1);
  assert.equal(server.requests.length, 2);
});
