import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createRewriteClient, rewriteCandidates, probeRewriteClient, rewriteFailureDetails } from '../rewriting/runner.js';
import { RewriteWorkerError } from '../rewriting/worker.js';
import { createRewriteDiagnostics } from '../rewriting/diagnostics.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';

const job = () => {
  const value = { _id: 'diagnostic-job', title: 'Engineer', company: 'Example', status: 'active',
    sourceDescription: 'Build reliable Python services for customers.', descriptionRewrite: { status: 'pending', attempts: 0 } };
  value.sourceContentHash = value.descriptionRewrite.inputHash = buildRewriteInput(value).inputHash;
  return value;
};

test('a generation HTTP failure retains its phase, status, original error and job identity', async t => {
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* consume the production request */ }
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'private upstream response must not be logged' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  let result, rejection;
  const stats = await rewriteCandidates([job()], { deadline: Date.now() + 5000,
    client: createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }),
    update: async () => ({ matchedCount: 1 }), onResult: value => { result = value; },
    onRejection: value => { rejection = value; },
  });
  assert.equal(stats.failed, 1);
  assert.equal(result.reason, 'generation_error');
  assert.equal(result.id, 'diagnostic-job');
  assert.ok(result.errorDiagnostic, 'the original generation error must survive queue handling');
  assert.equal(result.errorDiagnostic.phase, 'apply_template');
  assert.equal(result.errorDiagnostic.httpStatus, 503);
  assert.equal(result.errorDiagnostic.sourceOffset, 0);
  assert.match(result.errorDiagnostic.message, /Local generator HTTP 503/);
  assert.match(result.errorDiagnostic.stack, /prose\.js/);
  assert.deepEqual(rejection.response.errorDiagnostic, result.errorDiagnostic);
  assert.doesNotMatch(JSON.stringify(result), /private upstream response/);
});

test('rejection artifacts retain bounded error causes while redacting secrets before truncation', () => {
  const diagnostics = createRewriteDiagnostics();
  diagnostics.record({ id: 'diagnostic-job', reason: 'generation_error', input: { sourceDescription: 'Public employer wording.' },
    response: { errorDiagnostic: { name: 'TypeError', code: 'UND_ERR_SOCKET', phase: 'read_completion', sourceOffset: 77,
      message: 'Connection mongodb://user:password@private/db?token=abc and Authorization: Bearer private-token',
      stack: 'TypeError: private header\n    at readCompletion (file:///app/rewriting/runner.js:61:4)\n' + 'x'.repeat(20000),
      cause: { name: 'SyntaxError', message: 'Unexpected token in "private response text"', code: 'BAD_JSON', body: 'must not leak' },
      request: { headers: { authorization: 'must not leak' } } } } });
  const snapshot = diagnostics.snapshot(), error = snapshot.samples[0].error;
  assert.ok(error, 'rejection artifact must include sanitized structured error details');
  assert.equal(error.phase, 'read_completion');
  assert.equal(error.sourceOffset, 77);
  assert.equal(error.code, 'UND_ERR_SOCKET');
  assert.equal(error.cause.name, 'SyntaxError');
  assert.match(error.stack, /runner\.js:61:4/);
  const text = JSON.stringify(error);
  assert.doesNotMatch(text, /password|private-token|private response text|private header|must not leak|mongodb:\/\//);
  assert.ok(Buffer.byteLength(text) < 8192);
});

test('every probe slot has start and completion evidence even when a native failure aborts readiness', async () => {
  let slot = 0, active = 0;
  const events = [];
  let caught;
  try {
    await probeRewriteClient({ generate: async () => {
      const current = slot++; active++;
      await delay(5 + current * 5); active--;
      if (current === 1) throw new RewriteWorkerError('process_exit', { signal: 'SIGSEGV' });
      return { format: 'fact-plan', finishReason: 'stop', value: { categories: [], overviewFactId: 0 } };
    } }, { concurrency: 4, deadline: Date.now() + 5000, onProbeEvent: value => events.push(value) });
  } catch (error) { caught = error; }
  assert.equal(active, 0);
  assert.equal(caught?.workerSignal, 'SIGSEGV');
  assert.equal(events.filter(e => e.event === 'probe_started').length, 4);
  assert.equal(events.filter(e => e.event === 'probe_finished').length, 4);
  const details = rewriteFailureDetails(caught, 'probe_worker');
  assert.ok(details.workerProbe, 'fatal probe failures must retain all slot records');
  assert.equal(details.workerProbe.ready, false);
  assert.equal(details.workerProbe.probes.length, 4);
  assert.equal(details.workerProbe.probes[1].outcome, 'failed');
  assert.equal(details.workerProbe.probes[1].error.workerSignal, 'SIGSEGV');
  assert.ok(details.workerProbe.probes.every(p => Number.isFinite(p.durationMs) && p.startedAt && p.finishedAt));
});

test('probe diagnostics never replace an immutable cancellation reason', async () => {
  const controller = new AbortController();
  const reason = Object.freeze(new DOMException('Cancelled by caller', 'AbortError'));
  controller.abort(reason);
  let completed;
  await assert.rejects(probeRewriteClient({ generate: async () => { assert.fail('cancelled probes must not run'); } },
    { concurrency: 2, signal: controller.signal, onProbeComplete: details => { completed = details; } }), error => error === reason);
  assert.ok(completed, 'cancelled readiness must retain its completed slot records without mutating the reason');
  assert.equal(completed.ready, false);
  assert.equal(completed.probes.length, 2);
  assert.ok(completed.probes.every(probe => probe.finishedAt && probe.outcome === 'failed'));
});

test('malformed tokenizer responses retain the original parser exception without its response excerpt', async t => {
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* consume the production request */ }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('x"LEAK12345"z');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  let result;
  await rewriteCandidates([job()], { deadline: Date.now() + 5000,
    client: createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }),
    update: async () => ({ matchedCount: 1 }), onResult: value => { result = value; } });
  assert.equal(result.reason, 'generation_error');
  assert.equal(result.errorDiagnostic.name, 'SyntaxError');
  assert.equal(result.errorDiagnostic.phase, 'apply_template');
  assert.equal(result.errorDiagnostic.httpStatus, 200);
  assert.doesNotMatch(JSON.stringify(result.errorDiagnostic), /LEAK12345/);
});
