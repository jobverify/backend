import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRewriteClient } from '../rewriting/runner.js';

const source = 'Responsibilities:\nBuild reliable Python services and maintain automated tests.';
const jobs = Array.from({ length: 4 }, (_v, i) => ({ title: 'Engineer ' + i, company: 'Example', sourceDescription: source }));
const serverFor = async (t, { reject = false, httpError = false } = {}) => {
  let active = 0, peak = 0, requests = 0;
  let releaseResponses, responseGate = Promise.resolve();
  const holdResponsesUntil = count => {
    responseGate = new Promise(resolve => { releaseResponses = () => { if (active >= count) resolve(); }; });
  };
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'fixture' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests++; active++; peak = Math.max(peak, active);
    // Measure pending inference slots without relying on requests arriving within 25 ms.
    releaseResponses?.();
    await responseGate;
    await new Promise(resolve => setTimeout(resolve, 25)); active--;
    if (httpError) { res.statusCode = 500; return res.end(); }
    const input = data.messages.at(-1).content;
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text: reject ? 'Invented Java duties.' : input.replace('Build reliable', 'Develop reliable') }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { client: createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }),
    stats: () => ({ active, peak, requests }), resetPeak: () => { peak = 0; }, holdResponsesUntil };
};

test('latency comparison actually measures fresh one-versus-four requests on one warm client', { timeout: 10000 }, async t => {
  const { benchmarkRewriteLatency } = await import('../rewriting/latencyBenchmark.js');
  const server = await serverFor(t);
  const one = await benchmarkRewriteLatency(jobs, { client: server.client, concurrency: 1, cacheMode: 'refresh', targetMs: 1 });
  assert.equal(server.stats().peak, 1);
  assert.equal(one.summary.fresh.requests, 4);
  assert.equal(one.summary.fresh.accepted, 4);
  assert.equal(one.summary.fresh.acceptedUnderTarget, 0);
  server.resetPeak();
  server.holdResponsesUntil(4);
  const four = await benchmarkRewriteLatency(jobs, { client: server.client, concurrency: 4, cacheMode: 'refresh', targetMs: 3000, signal: t.signal });
  assert.equal(server.stats().peak, 4);
  assert.equal(server.stats().requests, 8);
  assert.equal(four.summary.fresh.requests, 4);
  assert.equal(four.summary.fresh.modelRequests, 4);
  assert.ok(four.summary.fresh.p95DurationMs > 0);
  const cached = await benchmarkRewriteLatency(jobs, { client: server.client, concurrency: 4, cacheMode: 'use' });
  assert.equal(cached.summary.cached.requests, 4);
  assert.equal(cached.summary.cached.accepted, 4);
  assert.equal(cached.summary.fresh.requests, 0);
  assert.equal(server.stats().requests, 8);
});

test('fast rejected output never counts as meeting the accepted-rewrite target', async t => {
  const { benchmarkRewriteLatency } = await import('../rewriting/latencyBenchmark.js');
  const server = await serverFor(t, { reject: true });
  const result = await benchmarkRewriteLatency(jobs.slice(0, 1), { client: server.client });
  assert.equal(result.summary.fresh.accepted, 0);
  assert.equal(result.summary.fresh.acceptedUnderTarget, 0);
  assert.equal(result.rows[0].accepted, false);
  assert.equal(result.rows[0].reason, 'source_details_changed');
  assert.match(result.rows[0].completionPreview, /Invented/);
});

test('latency measurements propagate programming failures rather than reporting fast rejections', async () => {
  const { benchmarkRewriteLatency } = await import('../rewriting/latencyBenchmark.js');
  await assert.rejects(benchmarkRewriteLatency(jobs, { client: { format: 'prose', generate: async () => { throw new TypeError('bug'); } } }), /bug/);
});

test('failed warmup retains attempted model work without claiming a successful inference', async t => {
  const { measureRewriteWarmup } = await import('../rewriting/latencyBenchmark.js');
  const { buildRewriteInput } = await import('../src/services/jobDescriptionPolicy.js');
  const server = await serverFor(t, { httpError: true });
  let measurement;
  await assert.rejects(measureRewriteWarmup(buildRewriteInput(jobs[0]), { client: server.client,
    onResult: result => { measurement = result; } }), error => error.name === 'RewriteGenerationError');
  assert.equal(measurement.generationRequests, 1);
  assert.equal(measurement.outputReceived, false);
  assert.equal(measurement.accepted, false);
  assert.equal(server.stats().requests, 1);
});

test('latency benchmark can exercise eight concurrent fresh rewrites and report wording throughput', { timeout: 10000 }, async t => {
  const { benchmarkRewriteLatency } = await import('../rewriting/latencyBenchmark.js');
  const server = await serverFor(t);
  server.holdResponsesUntil(8);
  const result = await benchmarkRewriteLatency([...jobs, ...jobs], { client: server.client, concurrency: 8, signal: t.signal });
  assert.equal(server.stats().peak, 8);
  assert.equal(result.summary.fresh.requests, 8);
  assert.equal(result.summary.fresh.modelRequests, 8);
  assert.equal(result.summary.fresh.wordingEdited, 8);
  assert.ok(result.summary.fresh.wordingEditedPerHour > 0);
  assert.equal(result.rows[0].quality.modelWordingEditedBlocks, 1);
});

test('production-style benchmark separates fallback publications from wording improvements', async t => {
  const { benchmarkRewriteLatency } = await import('../rewriting/latencyBenchmark.js');
  const server = await serverFor(t, { reject: true });
  const result = await benchmarkRewriteLatency(jobs, { client: server.client, allowSourceFallback: true });
  assert.equal(result.summary.fresh.accepted, 4);
  assert.equal(result.summary.fresh.fallbackDescriptions, 4);
  assert.equal(result.summary.fresh.wordingEdited, 0);
  assert.equal(result.summary.fresh.wordingEditedPerHour, 0);
  assert.equal(result.summary.fresh.correctionRequests, 3);
  assert.equal(result.summary.fresh.correctionsSkipped, 1);
  assert.equal(server.stats().requests, 7);
  assert.equal(result.rows[0].originalDescription, source);
  assert.match(result.rows[0].description, /Build reliable Python/);
});
