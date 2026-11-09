import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, rewriteCandidates } from '../rewriting/runner.js';
import { validateProseRewrite } from '../rewriting/prose.js';
import { createRewriteDiagnostics } from '../rewriting/diagnostics.js';
import { summarizeRewriteCapacity } from '../rewriting/capacity.js';

const inputFor = sourceDescription => buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription });
const sourceFor = (position, duty = 'Build Python services.', heading = 'Required qualifications') =>
  `Position: ${position}\nResponsibilities:\n${duty}\n${heading}:\nAt least 2 years of Java experience.`;

const serverFor = async (t, complete = source => source.replace('Build Python', 'Develop Python')) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(body.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests.push(body);
    const text = complete(body.messages.at(-1).content, requests.length);
    if (text === null) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'unavailable' })); }
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, requests };
};

test('repeated accepted fragments reuse inference across distinct jobs with their own metadata', async t => {
  const server = await serverFor(t), client = createRewriteClient(server);
  await client.generate(inputFor(sourceFor('Alpha')));
  const input = inputFor(sourceFor('Beta'));
  const response = await client.generate(input);
  assert.equal(response.generationRequests, 0);
  assert.equal(response.reusedChunks, 2);
  assert.equal(server.requests.length, 2);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Position: Beta/);
  assert.match(checked.description, /Develop Python services/);
});

test('changed fragment wording and inherited qualification scope require fresh inference', async t => {
  const server = await serverFor(t), client = createRewriteClient(server);
  await client.generate(inputFor(sourceFor('Alpha')));
  const changed = await client.generate(inputFor(sourceFor('Beta', 'Build Java services.')));
  assert.equal(changed.generationRequests, 1);
  const newScope = await client.generate(inputFor(sourceFor('Gamma', 'Build Python services.', 'Preferred qualifications')));
  assert.equal(newScope.generationRequests, 1);
  assert.equal(server.requests.length, 4);
});

test('refresh bypasses fragment reuse and strict mode does not reuse production fragments', async t => {
  const server = await serverFor(t), client = createRewriteClient(server);
  await client.generate(inputFor(sourceFor('Alpha')));
  const fresh = await client.generate(inputFor(sourceFor('Beta')), { cacheMode: 'refresh' });
  assert.equal(fresh.generationRequests, 2);
  assert.equal(fresh.reusedChunks, 0);
  const strict = await client.generate(inputFor(sourceFor('Gamma')), { allowSourceFallback: false });
  assert.equal(strict.generationRequests, 2);
});

test('a cached standalone edit is regenerated when it changes a continued statement in a different job', async t => {
  let standalone = true;
  const fragment = 'Build Python services. ';
  const server = await serverFor(t, source => standalone
    ? source.replace('Build Python', 'The role involves developing Python') : source);
  const client = createRewriteClient(server);
  const first = await client.generate(inputFor(`Position: Alpha\n${fragment}Location: Pune`));
  assert.match(first.value.parts.find(part => !part.protected).text, /The role involves/);
  standalone = false;
  const prefix = 'Support '.repeat(112) + 'our ';
  const input = inputFor(`Position: Beta\n${prefix}${fragment}Location: Pune`);
  const response = await client.generate(input);
  assert.equal(response.generationRequests, 2);
  assert.equal(response.reusedChunks, 0);
  assert.equal(response.validationFailure, undefined);
  const checked = validateProseRewrite(response.value, input, 'stop');
  assert.equal(checked.ok, true);
  assert.doesNotMatch(checked.description, /The role involves/);
});

test('rejected fragments and their source fallbacks never satisfy a later model request', async t => {
  const server = await serverFor(t, source => source.replace('Python', 'Java'));
  const client = createRewriteClient(server);
  await client.generate(inputFor('Position: Alpha\nResponsibilities:\nBuild Python services.'));
  const input = inputFor('Position: Beta\nResponsibilities:\nBuild Python services.');
  const response = await client.generate(input);
  assert.equal(response.generationRequests, 2);
  assert.equal(response.reusedChunks, 0);
  assert.equal(validateProseRewrite(response.value, input, 'stop').quality.sourceFallbackBlocks, 1);
});

test('successful fallback publication retains fragment rejection evidence without rejecting the job', async t => {
  const server = await serverFor(t, source => source.replace('Python', 'Java'));
  const diagnostics = createRewriteDiagnostics();
  const sourceDescription = 'Build Python services.';
  const input = inputFor(sourceDescription), results = [];
  const stats = await rewriteCandidates([{ _id: 'rewrite-evidence-job', title: 'Engineer', company: 'Example', status: 'active',
    sourceDescription, sourceContentHash: input.inputHash, descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async () => ({ matchedCount: 1 }), onResult: result => results.push(result),
    onRejection: rejection => diagnostics.record(rejection),
    onFragmentRejection: rejection => diagnostics.record({ ...rejection, kind: 'fragment' }),
  });
  assert.equal(stats.published, 1);
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.totalRejected, 0);
  assert.equal(snapshot.totalRejectedFragments, 2);
  assert.equal(snapshot.fragmentReasons.source_details_changed, 2);
  assert.equal(snapshot.samples[0].id, 'rewrite-evidence-job');
  assert.equal(snapshot.samples[0].kind, 'fragment');
  assert.equal(snapshot.samples[0].sourceContext, 'Build Python services.');
  assert.match(snapshot.samples[0].completionPreview, /Build Java services/);
  assert.doesNotMatch(JSON.stringify(results), /Build Java services/);
});

test('a successful correction retains the first rejected fragment with its original candidate', async t => {
  const server = await serverFor(t, (source, count) => source.replace('Build Python', count === 1 ? 'Build Java' : 'Develop Python'));
  const rejections = [], input = inputFor('Build Python services.');
  const response = await createRewriteClient(server).generate(input, { onFragmentRejection: rejection => rejections.push(rejection) });
  assert.equal(validateProseRewrite(response.value, input, 'stop').quality.modelWordingEditedBlocks, 1);
  assert.equal(rejections.length, 1);
  assert.equal(rejections[0].reason, 'source_details_changed');
  assert.match(rejections[0].response.rawText, /Build Java services/);
});

test('shared generation records each underlying rejected attempt once across callers', async t => {
  const server = await serverFor(t, source => source.replace('Python', 'Java'));
  const client = createRewriteClient(server), diagnostics = createRewriteDiagnostics();
  const options = { onFragmentRejection: rejection => diagnostics.record({ ...rejection, kind: 'fragment' }) };
  const results = await Promise.all([client.generate(inputFor('Build Python services.'), options),
    client.generate(inputFor('Build Python services.'), options)]);
  assert.equal(results.reduce((sum, result) => sum + result.generationRequests, 0), 2);
  assert.equal(diagnostics.snapshot().totalRejectedFragments, 2);
});

test('fragment and final job evidence share bounded samples while retaining independent totals', () => {
  const diagnostics = createRewriteDiagnostics({ maxSamples: 2, maxBytes: 12000 });
  for (let i = 0; i < 100; i++) diagnostics.record({ kind: 'fragment', reason: 'source_details_changed',
    diagnostic: { evidence: 'Employer source. '.repeat(1000), text: 'Changed source. '.repeat(1000) } });
  diagnostics.record({ reason: 'timeout' });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.totalRejected, 1);
  assert.equal(snapshot.totalRejectedFragments, 100);
  assert.equal(snapshot.fragmentReasons.source_details_changed, 100);
  assert.ok(snapshot.samples.some(sample => sample.reason === 'timeout'));
  assert.ok(snapshot.samples.length <= 2);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) <= 12000);
});

test('capacity distinguishes wording edits from layout-only publications and reports reused chunks', () => {
  const capacity = summarizeRewriteCapacity([
    { ok: true, generationRequests: 1, reusedChunks: 2, quality: { modelWordingEditedBlocks: 1, modelLayoutEditedBlocks: 1 } },
    { ok: true, generationRequests: 1, quality: { modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 2 } },
    { ok: true, generationRequests: 1, quality: { modelWordingEditedBlocks: 0, modelLayoutEditedBlocks: 0 } },
    { ok: true, generationRequests: 1, quality: { modelEditedBlocks: 1 } },
    { ok: false, generationRequests: 1, quality: { modelWordingEditedBlocks: 5, modelLayoutEditedBlocks: 0 } },
    { ok: true, published: false, generationRequests: 1, quality: { modelWordingEditedBlocks: 5, modelLayoutEditedBlocks: 0 } },
  ]);
  assert.equal(capacity.modelWordingEditedDescriptions, 1);
  assert.equal(capacity.modelLayoutOnlyDescriptions, 1);
  assert.equal(capacity.wordingMetricsRecordedDescriptions, 3);
  assert.equal(capacity.reusedChunks, 2);
});

test('failed generation retains earlier accepted-fragment reuse in result and capacity metrics', async t => {
  const server = await serverFor(t, source => source.includes('3 years') ? null : source);
  const client = createRewriteClient(server);
  await client.generate(inputFor(sourceFor('Alpha')));
  const sourceDescription = sourceFor('Beta').replace('2 years', '3 years');
  const input = inputFor(sourceDescription), results = [];
  const stats = await rewriteCandidates([{ _id: 'failed-reuse-job', title: 'Engineer', company: 'Example', status: 'active',
    sourceDescription, sourceContentHash: input.inputHash, descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client, deadline: Date.now() + 10000, update: async () => ({ matchedCount: 1 }), onResult: result => results.push(result),
  });
  assert.equal(stats.failed, 1);
  assert.equal(results[0].reusedChunks, 1);
  assert.equal(summarizeRewriteCapacity(results).reusedChunks, 1);
});
