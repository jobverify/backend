import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildRewriteInput, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient } from '../rewriting/runner.js';
import { buildProseBlocks } from '../rewriting/proseBlocks.js';
import { proseSource, validateProsePart, validateProseRewrite } from '../rewriting/prose.js';
import { reconcileRewriteCandidate } from '../rewriting/queue.js';

const inputFor = sourceDescription => buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription });
const serverFor = async (t, complete) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(body.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests.push(body);
    const text = complete(body.messages.at(-1).content, requests.length, body);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, requests };
};

const continuation = 'Deliver reliable software to customers across the enterprise while reviewing changes '.repeat(26).trim();
const addTerminalStop = text => /[.!?]\s*$/.test(text) ? text : text.trimEnd() + '.';

test('report regression: a locally valid full stop inside a split statement retains source and other accepted edits', async t => {
  const source = `Responsibilities:\n${continuation}\n\nRole overview:\nBuild Python services.\nLocation: Pune`;
  const server = await serverFor(t, text => addTerminalStop(text).replace('Build Python', 'Develop Python'));
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  assert.equal(response.validationFailure, undefined);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Develop Python services/);
  assert.match(checked.description, /Location: Pune/);
  assert.ok(checked.quality.sourceFallbackBlocks > 0);
  assert.ok(checked.quality.modelEditedBlocks > 0);
  assert.ok(response.generations.some(generation => generation.validationPhase === 'assembly'));
  assert.ok(response.value.parts.filter(part => part.fallbackReason).every(part => part.text === part.source));
});

test('report regression: strict mode stops at the offending boundary after one correction', async t => {
  const server = await serverFor(t, addTerminalStop);
  const response = await createRewriteClient(server).generate(inputFor(continuation), { allowSourceFallback: false });
  assert.equal(response.value, null);
  assert.equal(response.validationFailure.reason, 'source_details_changed');
  assert.equal(response.validationFailure.diagnostic.phase, 'assembly');
  assert.equal(response.generationRequests, 2);
  assert.equal(server.requests.length, 2);
});

test('report regression: a checkpoint that only passes fragment checks is regenerated in full context', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-context-checkpoint-'));
  t.after(async () => {
    for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file));
    await fs.rmdir(directory);
  });
  const input = inputFor(continuation), source = proseSource(input);
  const first = buildProseBlocks(source)[0];
  const text = addTerminalStop(first.source);
  assert.equal(validateProsePart(first.source, text), null, 'the old fragment-only checkpoint check accepts this edit');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const key = createHash('sha256').update(JSON.stringify(['prose-source-cache-v3', REWRITE_MODEL, sourceHash, true])).digest('hex');
  await fs.writeFile(path.join(directory, key + '.json.partial'), JSON.stringify({ sourceHash,
    parts: [{ ...first, text }] }));
  const server = await serverFor(t, text => text);
  const response = await createRewriteClient({ ...server, planCacheDir: directory }).generate(input);
  assert.equal(response.validationFailure, undefined);
  assert.equal(validateProseRewrite(response.value, input, response.finishReason).ok, true);
  assert.equal(response.reusedChunks, 0);
  assert.equal(server.requests[0].messages.at(-1).content, first.source);
});

const htmlSource = 'Build reliable Python services.\nMaintain automated tests.';
test('report regression: completed HTML output receives a Markdown correction', async t => {
  const server = await serverFor(t, (source, count) => count === 1 ? source.replace('\n', '<br>')
    : source.replace('Build reliable', 'Develop reliable'));
  const input = inputFor(htmlSource);
  const response = await createRewriteClient(server).generate(input, { allowSourceFallback: false });
  assert.equal(response.validationFailure, undefined);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Develop reliable Python/);
  assert.doesNotMatch(checked.description, /<br>/);
  assert.equal(response.generationRequests, 2);
  assert.equal(response.generations[1].corrective, true);
  assert.match(server.requests[1].messages[0].content, /unsafe_output/);
});

test('report regression: repeated completed HTML retains exact source with explicit fallback quality', async t => {
  const server = await serverFor(t, source => source.replace('\n', '<br>'));
  const input = inputFor(htmlSource), client = createRewriteClient(server);
  const response = await client.generate(input);
  assert.equal(response.validationFailure, undefined);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.equal(checked.description, htmlSource);
  assert.equal(checked.quality.sourceFallbackBlocks, 1);
  assert.equal(checked.quality.modelEditedBlocks, 0);
  assert.equal(checked.quality.outcome, 'source_fallback');
  assert.equal(response.value.parts[0].text, response.value.parts[0].source);
  assert.equal(response.generationRequests, 2);
  const next = await client.generate(input);
  assert.equal(next.cachedModelPlan, undefined);
  assert.equal(next.generationRequests, 2, 'rejected HTML never becomes an accepted model cache');
});

test('report regression: repeated HTML still fails strict evaluation after its bounded correction', async t => {
  const server = await serverFor(t, source => source.replace('\n', '<br>'));
  const response = await createRewriteClient(server).generate(inputFor(htmlSource), { allowSourceFallback: false });
  assert.equal(response.value, null);
  assert.equal(response.validationFailure.reason, 'unsafe_output');
  assert.equal(response.generationRequests, 2);
  assert.equal(server.requests.length, 2);
});

test('report regression: failed v26 jobs receive a fresh guarded attempt budget', async () => {
  const input = inputFor(htmlSource);
  const job = { _id: 'v26-report-failure', title: 'Engineer', company: 'Example', status: 'active',
    sourceDescription: htmlSource, sourceContentHash: input.inputHash,
    descriptionRewrite: { status: 'failed', inputHash: input.inputHash, attempts: 3,
      policyVersion: 'job-description-prose-v26', reason: 'unsafe_output', nextAttemptAt: null } };
  let write;
  const result = await reconcileRewriteCandidate(job, { update: async (filter, update) => {
    write = { filter, update };
    return { matchedCount: 1 };
  } });
  assert.equal(result.kind, 'ready');
  assert.equal(result.repaired, true);
  assert.equal(result.job.descriptionRewrite.attempts, 0);
  assert.equal(result.job.descriptionRewrite.policyVersion, REWRITE_MODEL.policyVersion);
  assert.equal(write.filter.sourceContentHash, input.inputHash);
  assert.equal(write.update.$set.sourceDescription, undefined);
});

test('report regression: an accepted v26 cache cannot bypass the repaired generation policy', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-v26-cache-'));
  t.after(async () => {
    for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file));
    await fs.rmdir(directory);
  });
  const input = inputFor(htmlSource), source = proseSource(input);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const legacyModel = { ...REWRITE_MODEL, policyVersion: 'job-description-prose-v26' };
  const key = createHash('sha256').update(JSON.stringify(['prose-source-cache-v3', legacyModel, sourceHash, true])).digest('hex');
  await fs.writeFile(path.join(directory, key + '.json'), JSON.stringify({ inputHash: input.inputHash, sourceHash,
    parts: [{ source, text: source, sourceOffset: 0 }] }));
  const server = await serverFor(t, source => source.replace('Build reliable', 'Develop reliable'));
  const response = await createRewriteClient({ ...server, planCacheDir: directory }).generate(input);
  assert.equal(response.cachedModelPlan, undefined);
  assert.equal(response.generationRequests, 1);
  assert.match(validateProseRewrite(response.value, input, response.finishReason).description, /Develop reliable Python/);
});
