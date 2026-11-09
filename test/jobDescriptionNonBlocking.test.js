import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as runner from '../rewriting/runner.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { stageOutcome } from '../src/pipeline/policy.js';

const candidate = () => {
  const job = { _id: 'nonblocking-rewrite', title: 'Software Engineer', company: 'Example', status: 'active',
    sourceDescription: 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.',
    descriptionRewrite: { status: 'pending', attempts: 0 } };
  job.sourceContentHash = job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
  return job;
};

for (const kind of ['http-error', 'invalid-json', 'invalid-stream', 'empty-stream', 'invalid-gzip', 'timeout']) {
  test(`a model ${kind} preserves source and becomes a pipeline warning`, async t => {
    const server = http.createServer((request, response) => {
      request.resume();
      if (kind === 'timeout') return;
      if (kind === 'http-error') { response.statusCode = 500; response.end(); }
      else if (kind === 'invalid-json') { response.setHeader('Content-Type', 'application/json'); response.end('invalid JSON'); }
      else if (kind === 'empty-stream') { response.statusCode = 204; response.setHeader('Content-Type', 'text/event-stream'); response.end(); }
      else if (kind === 'invalid-gzip') { response.setHeader('Content-Type', 'application/json'); response.setHeader('Content-Encoding', 'gzip'); response.end('invalid compressed data'); }
      else { response.setHeader('Content-Type', 'text/event-stream'); response.end('data: invalid JSON\n\n'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    let saved;
    const stats = await runner.rewriteCandidates([candidate()], {
      client: runner.createRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port, requestMs: kind === 'timeout' ? 100 : 2000 }),
      deadline: Date.now() + 10000, update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; },
    });
    assert.equal(stats.failed, 1); assert.equal(saved.$set.description, undefined); assert.equal(saved.$set.sourceDescription, undefined);
    const summary = { queued: 1, ...stats, ...runner.rewriteProgress({ queued: 1, ...stats }) };
    assert.equal(summary.warnings, 1); assert.equal(summary.pendingEstimate, 0);
    assert.equal(stageOutcome('rewrite', summary, 0), 'completed');
  });
}

test('unexpected programming exceptions stop rewriting instead of becoming job warnings', async () => {
  for (const error of [new TypeError('Unexpected implementation bug'), new Error('Unexpected code failure')]) {
    let writes = 0;
    await assert.rejects(runner.rewriteCandidates([candidate()], { deadline: Date.now() + 10000,
      client: { generate: async () => { throw error; } },
      update: async () => { writes++; return { matchedCount: 1 }; },
    }), actual => actual === error);
    assert.equal(writes, 0);
  }
});

test('rewrite progress counts deferred records as warnings and detects unvisited work', () => {
  const observed = { queued: 3103, published: 2793, skipped: 309, failed: 1 };
  assert.deepEqual(runner.rewriteProgress(observed), { warnings: 1, pendingEstimate: 0 });
  const deferred = { queued: 4, published: 1, failed: 1, staleSources: 1, concurrentChanges: 1 };
  assert.deepEqual(runner.rewriteProgress(deferred), { warnings: 3, pendingEstimate: 0 });
  assert.deepEqual(runner.rewriteProgress({ ...deferred, queued: 5 }), { warnings: 3, pendingEstimate: 1 });
  assert.deepEqual(runner.rewriteProgress({ queued: 2, published: 1, workerProbe: { warnings: 4 } }), { warnings: 4, pendingEstimate: 1 });
});

test('rejected readiness prevents production attempts and still permits classification handoff', async () => {
  const result = await runner.probeRewriteClient({ generate: async () => ({ value: null, finishReason: 'length' }) },
    { concurrency: 4, deadline: Date.now() + 10000 });
  assert.equal(result.warnings, 4);
  assert.equal(result.ready, false);
  let scheduled = 0;
  const stopped = await runner.rewriteWhenReady(result, async () => { scheduled++; });
  assert.equal(scheduled, 0);
  assert.equal(stopped.reason, 'model_quality_unavailable');
  assert.equal(stopped.qualityStopped, true);
  const summary = { queued: 100, workerProbe: result, ...stopped, ...runner.rewriteProgress({ queued: 100, workerProbe: result }) };
  assert.equal(stageOutcome('rewrite', summary, 0), 'completed');
  const { describeStageCompletion } = await import('../src/pipeline/policy.js');
  assert.equal(describeStageCompletion('rewrite', summary, 'completed').processingComplete, false);
  assert.equal(describeStageCompletion('rewrite', summary, 'completed').handoffReady, true);
  assert.equal(stageOutcome('rewrite', { ...summary, errorType: 'TypeError' }, 1), 'failed');
  assert.equal(stageOutcome('rewrite', { ...summary, cancelled: true }, 0), 'incomplete');
});

test('successful readiness runs the production callback exactly once', async () => {
  let scheduled = 0;
  const result = await runner.rewriteWhenReady({ ready: true, requests: 4 }, async () => { scheduled++; return { published: 2 }; });
  assert.equal(scheduled, 1);
  assert.equal(result.published, 2);
});

test('a warning in one startup probe cannot hide a code failure in another', async () => {
  let requests = 0;
  await assert.rejects(runner.probeRewriteClient({ generate: async () => {
    if (requests++ === 0) return { value: null, finishReason: 'length' };
    throw new TypeError('Unexpected code failure');
  } }, { concurrency: 4, deadline: Date.now() + 10000 }), error => error.name === 'RewriteWorkerError');
  assert.equal(requests, 4);
});
