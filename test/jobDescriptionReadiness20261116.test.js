import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, probeRewriteClient } from '../rewriting/runner.js';
import { proseSource, validateProsePart, validateProseRewrite } from '../rewriting/prose.js';

const source = 'Role overview: Build Python services for customer group 1. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
// Exact completion captured in the November 16 failed readiness artifacts.
const rejected = 'We seek a candidate to build Python services for customer group 1. The role involves designing reliable APIs and maintaining Python services. Required qualifications include at least 2 years of software development experience. Preferred qualifications are AWS experience. The position focuses on building and sustaining these services.';
const originalStatement = 'Build Python services for customer group 1.';
const rejectedStatement = 'We seek a candidate to build Python services for customer group 1.';

test('captured recruiting boilerplate remains rejected by factual validation', () => {
  assert.equal(validateProsePart(source, rejected), 'source_details_changed');
  assert.equal(validateProsePart(source, source.replace('At least 2', 'At least 5')), 'numeric_relationship_changed');
});

test('a captured readiness rejection is corrected using its actual source and rejected statement', async t => {
  let generations = 0;
  const server = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const request = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(request.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    generations++;
    const feedback = request.messages[0].content;
    const receivedMismatch = feedback.includes(originalStatement) && feedback.includes(rejectedStatement);
    const text = generations > 1 && receivedMismatch ? source.replace('Build Python', 'Develop Python') : rejected;
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` });
  const input = buildRewriteInput({ sourceDescription: source });
  const response = await client.generate(input, { allowSourceFallback: false });
  assert.equal(response.validationFailure, undefined);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Develop Python services for customer group 1/);
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
  assert.equal(response.generationRequests, 2);
  assert.equal(response.correctionRequests, 1);
  assert.equal(response.correctionsAccepted, 1);
});

test('readiness measures fresh generations and corrections without production attempts', async () => {
  const result = await probeRewriteClient({ format: 'prose', generate: async (input, options) => {
    assert.equal(options.cacheMode, 'refresh');
    assert.equal(options.allowSourceFallback, false);
    return { format: 'prose', finishReason: 'stop', generationRequests: 2, correctionRequests: 1,
      correctionsAccepted: 1, correctionsRejected: 0, correctionsSkipped: 0,
      value: { inputHash: input.inputHash, parts: [{ source: proseSource(input), text: proseSource(input) }] } };
  } }, { concurrency: 4 });
  assert.equal(result.ready, true);
  assert.equal(result.requests, 4);
  assert.equal(result.generationRequests, 8);
  assert.equal(result.correctionRequests, 4);
  assert.equal(result.correctionsAccepted, 4);
  assert.ok(result.probes.every(probe => probe.generationRequests === 2));
});

test('rejected readiness retains its generation costs', async () => {
  const result = await probeRewriteClient({ generate: async () => ({ finishReason: 'stop', generationRequests: 2,
    correctionRequests: 1, correctionsRejected: 1,
    validationFailure: { ok: false, reason: 'source_details_changed' } }) }, { concurrency: 4 });
  assert.equal(result.ready, false);
  assert.equal(result.generationRequests, 8);
  assert.equal(result.correctionsRejected, 4);
});
