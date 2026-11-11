import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, rewriteCandidates, probeRewriteClient } from '../rewriting/runner.js';
import { proseSource, splitProseSource, validateProseRewrite } from '../rewriting/prose.js';

const source = 'Responsibilities:\nBuild reliable Python applications for customers and maintain automated tests.\nRequirements:\nAt least 2 years of experience is required. AWS experience is preferred.';
const inputFor = sourceDescription => buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription });
const serverFor = async (t, { tokens = () => 300, complete, stream = false } = {}) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(request.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: Array(tokens(request.content)).fill(1) }));
    requests.push(request);
    const data = { source: request.messages.at(-1).content };
    const result = await complete?.(data, request, requests.length) || { text: data.source.replace('Build reliable', 'Develop reliable'), reason: 'stop' };
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      return res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify({ text: result.text }) }, finish_reason: result.reason || 'stop' }] }) + '\n\ndata: [DONE]\n\n');
    }
    res.end(JSON.stringify({ choices: [{ finish_reason: result.reason || 'stop', message: { content: JSON.stringify({ text: result.text }) } }],
      usage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 }, timings: { predicted_ms: 25 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, requests };
};

test('reproduced work-model duplication is cleaned through inference and final assembly without fallback', async t => {
  const original = 'The work model for the role is: The work model for the role is: #Li_Onsite.';
  const server = await serverFor(t, { complete: () => ({ text: 'The work model for the role is: #Li_Onsite.' }) });
  const input = inputFor(original);
  const response = await createRewriteClient(server).generate(input, { allowSourceFallback: false });
  const checked = validateProseRewrite(response.value, input, 'stop');
  assert.equal(response.generationRequests, 1);
  assert.equal(checked.ok, true);
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
  assert.equal(checked.quality.modelWordingEditedBlocks, 1);
  assert.equal(checked.description, 'The work model for the role is: #Li_Onsite.');
});

test('inline employer metadata is preserved without depending on model inference', async t => {
  const original = 'Position: DFT Engineer Job Description: Location: IN-KA-Bangalore, India Time Type: Full time Job Category: Engineering Services';
  const server = await serverFor(t);
  const input = inputFor(original);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, 'stop');
  assert.equal(response.generationRequests, 0);
  assert.equal(server.requests.length, 0);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Location: IN-KA-Bangalore, India/);
  assert.match(checked.description, /Time Type: Full time/);
  assert.match(checked.description, /Job Category: Engineering Services/);
  assert.equal(checked.quality.modelEditedBlocks, 0);
  assert.ok(checked.quality.protectedSourceBlocks > 0);
});

test('long descriptions are generated in bounded sections with metadata kept outside the prompt', async t => {
  const original = 'Responsibilities:\n' + 'Build reliable customer services. '.repeat(28)
    + '\nRequired qualifications:\nAt least 2 years of Python experience is required.\nLocation: Mumbai\nTime Type: Full time';
  const server = await serverFor(t);
  const input = inputFor(original);
  const response = await createRewriteClient(server).generate(input);
  assert.ok(server.requests.length > 1);
  assert.ok(server.requests.every(request => request.messages.at(-1).content.length <= 900));
  assert.ok(server.requests.every(request => !/Location:|Time Type:/.test(request.messages.at(-1).content)));
  assert.equal(response.value.parts.map(part => part.source).join(''), original);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
});

test('production retains the original failed block and reports it separately from model edits', async t => {
  const original = 'Role overview:\nSupport customer integrations.\nResponsibilities:\n' + 'Build reliable Python services. '.repeat(25)
    + '\nLocation: Mumbai';
  const server = await serverFor(t, { complete: data => ({ text: data.source.includes('Support customer')
    ? 'Invented Kotlin duties.' : data.source.replaceAll('Build reliable', 'Develop reliable') }) });
  const input = inputFor(original);
  let saved;
  const client = createRewriteClient(server);
  const stats = await rewriteCandidates([{ _id: 'complete-blocks', status: 'active', title: 'Engineer', company: 'Example',
    sourceDescription: original, sourceContentHash: input.inputHash,
    descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client, deadline: Date.now() + 10000,
    update: async (_filter, update) => { saved = update; return { matchedCount: 1 }; },
  });
  assert.equal(stats.published, 1);
  assert.match(saved.$set.description, /Develop reliable Python services/);
  assert.match(saved.$set.description, /Support customer integrations/);
  assert.doesNotMatch(saved.$set.description, /Kotlin/);
  const quality = saved.$set['descriptionRewrite.quality'];
  assert.ok(quality.modelEditedBlocks > 0);
  assert.ok(quality.sourcePreservedBlocks > 0);
  assert.equal(quality.sourceFallbackBlocks, 1);
  const strict = await client.generate(input, { allowSourceFallback: false });
  assert.equal(strict.value, null);
  assert.equal(strict.validationFailure.reason, 'source_details_changed');
});

test('production accepts short and large source text without text-size eligibility ceilings', () => {
  assert.equal(inputFor('Build services.').eligible, true);
  assert.equal(inputFor('Build services. '.repeat(5000)).eligible, true);
  assert.equal(inputFor('<p> </p>').eligible, false);
});

test('production rephrases source prose and publishes through the existing guarded update', async t => {
  const server = await serverFor(t);
  const input = inputFor(source);
  let saved;
  const stats = await rewriteCandidates([{ _id: 'prose', status: 'active', title: 'Engineer', company: 'Example', sourceDescription: source,
    sourceContentHash: input.inputHash, descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async (_filter, update) => { saved = update; return { matchedCount: 1 }; },
  });
  assert.equal(REWRITE_MODEL.outputFormat, 'prose');
  assert.equal(stats.published, 1);
  assert.match(saved.$set.description, /Develop reliable Python/);
  assert.match(saved.$set.description, /2 years/);
  assert.equal(saved.$set.sourceDescription, undefined);
  assert.ok(server.requests[0].max_tokens <= REWRITE_MODEL.contextTokens - 300 - 64);
});

test('short fragments cannot consume an entire context window of output', async t => {
  const server = await serverFor(t);
  const input = inputFor('Build Python services.');
  const response = await createRewriteClient(server).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.ok(server.requests[0].max_tokens < 1024, 'source-sized allowance must prevent a tiny fragment generating 8K tokens');
});

test('whitespace-only source spans preserve their layout without an empty-output rejection', () => {
  const original = 'Build Python services.\n   \nMaintain tests.';
  const input = inputFor(original);
  const parts = ['Build Python services.', '\n   \n', 'Maintain tests.'].map(source => ({ source, text: source }));
  const checked = validateProseRewrite({ inputHash: input.inputHash, parts }, input, 'stop');
  assert.equal(checked.ok, true);
  assert.equal(checked.description, original);
});

test('physical splits inside an identifier reconstruct its exact source boundary', () => {
  const original = 'CustomerIntegrationService';
  const input = inputFor(original);
  const parts = ['CustomerIntegr', 'ationService'].map(source => ({ source, text: source }));
  const checked = validateProseRewrite({ inputHash: input.inputHash, parts }, input, 'stop');
  assert.equal(checked.ok, true);
  assert.equal(checked.description, original);
});

test('empty model text gets one full-source correction without accepting empty fallback', async t => {
  const server = await serverFor(t, { complete: (data, _request, count) => ({ text: count === 1 ? '' : data.source }) });
  const input = inputFor('Build Python services.');
  const response = await createRewriteClient(server).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(server.requests.length, 2);
  assert.equal(response.generations[1].corrective, true);
  assert.equal(server.requests[1].messages.at(-1).content, 'Build Python services.');
});

test('a fragment rejection identifies its failing phase and source offset', () => {
  const original = 'Build Python services.\nMaintain tests.';
  const input = inputFor(original);
  const checked = validateProseRewrite({ inputHash: input.inputHash, parts: [
    { source: 'Build Python services.\n', text: 'Build Python services.\n', sourceOffset: 0 },
    { source: 'Maintain tests.', text: 'Invented Kubernetes skills.', sourceOffset: 23 },
  ] }, input, 'stop');
  assert.equal(checked.ok, false);
  assert.equal(checked.diagnostic?.phase, 'fragment');
  assert.equal(checked.diagnostic?.sourceOffset, 23);
  assert.equal(checked.diagnostic?.evidence, 'Maintain tests.');
});

test('individually valid fragments cannot conceal a changed identifier after assembly', () => {
  const input = inputFor('buildingService');
  const checked = validateProseRewrite({ inputHash: input.inputHash, parts: [
    { source: 'build', text: 'develop', sourceOffset: 0 },
    { source: 'ingService', text: 'ingService', sourceOffset: 5 },
  ] }, input, 'stop');
  assert.equal(checked.ok, false);
  assert.equal(checked.reason, 'source_details_changed');
  assert.equal(checked.diagnostic?.phase, 'assembly');
  assert.equal(checked.diagnostic?.evidence, 'buildingService');
  assert.equal(checked.diagnostic?.text, 'developingService');
});

test('malformed JSON gets one fresh correction and preserves strict source validation', async t => {
  let completions = 0;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body);
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'source' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    completions++;
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: completions === 1 ? '{"text":' : JSON.stringify({ text: request.messages.at(-1).content }),
    } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const input = inputFor('Build Python services.');
  let response;
  await assert.doesNotReject(async () => {
    response = await createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }).generate(input, { allowSourceFallback: false });
  });
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(response.generationRequests, 2);
  assert.equal(response.generations[1].corrective, true);
});

test('generation and correction prompts contain only the current employer source facts', async t => {
  const server = await serverFor(t, { complete: (data, _request, count) => ({ text: count === 1 ? data.source.replace('2 years', '10 years') : data.source }) });
  const response = await createRewriteClient(server).generate(inputFor(source), { allowSourceFallback: false });
  assert.equal(response.generationRequests, 2);
  for (const request of server.requests) {
    const suppliedSources = request.messages.filter(message => message.role === 'user').map(message => message.content);
    assert.deepEqual(suppliedSources, [source]);
    assert.equal(request.messages.some(message => message.role === 'assistant'), false);
    assert.doesNotMatch(JSON.stringify(request.messages), /At least 3 years/);
  }
});

test('dense and oversized source is chunked without losing text or imposing an aggregate output cap', async t => {
  const server = await serverFor(t, { tokens: prompt => prompt.length > 4500 ? 7500 : 1000 });
  const input = inputFor('Responsibilities:\n' + 'Build reliable customer services and maintain automated tests. '.repeat(600));
  const response = await createRewriteClient(server).generate(input, { remainingMs: 30000 });
  assert.equal(response.finishReason, 'stop');
  assert.ok(server.requests.length > 1);
  assert.ok(response.value.parts.map(p => p.source).join('').length > 24000);
  assert.ok(response.value.parts.map(p => p.text).join('').length > 24000);
});

test('token-truncated output splits and retries the complete source rather than publishing a prefix', async t => {
  const server = await serverFor(t, { complete: (data, _request, count) => count === 1 ? { text: 'partial', reason: 'length' } : { text: data.source } });
  const response = await createRewriteClient(server).generate(inputFor(source));
  assert.equal(response.finishReason, 'stop');
  assert.ok(server.requests.length > 1);
  assert.equal(response.value.parts.map(p => p.source).join(''), source);
  assert.ok(response.value.parts.every(p => p.text !== 'partial'));
});

test('changed factual numbers cannot be published', async t => {
  const server = await serverFor(t, { complete: data => ({ text: data.source.replace('2 years', '10 years') }) });
  const response = await createRewriteClient(server).generate(inputFor(source));
  const checked = validateProseRewrite(response.value, inputFor(source), 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /2 years/);
  assert.doesNotMatch(checked.description, /10 years/);
  assert.ok(response.generationRequests > 0);
  assert.ok(checked.quality.sourceFallbackBlocks > 0);
});

test('a rejected rewrite gets one source-grounded correction before publication', async t => {
  const source = 'Role overview: Build Python services for customer group 2. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
  const recorded = 'The role focuses on building Python services for a particular customer group, requiring strong API design skills and ongoing service upkeep. Candidates should have at least two years of software development experience, with AWS experience being a nice-to-have.';
  const server = await serverFor(t, { complete: (data, _request, count) => ({ text: count === 1 ? recorded : data.source.replace('Build Python', 'Develop Python') }) });
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input, { allowSourceFallback: false });
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(response.generationRequests, 2);
  assert.equal(server.requests.length, 2);
  const repair = server.requests[1].messages.at(-1).content;
  assert.equal(repair, source);
  assert.match(server.requests[1].messages[0].content, /previous attempt failed numeric_relationship_changed/);
  assert.doesNotMatch(repair, /validationFeedback/);
  assert.match(response.value.parts[0].text, /customer group 2/);
});

test('strict inference rejects an unsuccessful correction without caching it', async t => {
  let corrected = false;
  const server = await serverFor(t, { complete: data => ({ text: corrected ? data.source : data.source.replace('2 years', '10 years') }) });
  const client = createRewriteClient(server), input = inputFor(source);
  const rejected = await client.generate(input, { allowSourceFallback: false });
  assert.equal(rejected.value, null);
  assert.equal(rejected.validationFailure.reason, 'numeric_relationship_changed');
  assert.equal(rejected.generationRequests, 2);
  assert.equal(server.requests.length, 2);
  corrected = true;
  const accepted = await client.generate(input, { allowSourceFallback: false });
  assert.equal(validateProseRewrite(accepted.value, input, 'stop').ok, true);
  assert.equal(accepted.cachedModelPlan, undefined);
  assert.equal(server.requests.length, 3);
});

test('every readiness slot must pass fresh validation after its corrective generation', async t => {
  const calls = new Map();
  const server = await serverFor(t, { complete: data => {
    const count = (calls.get(data.source) || 0) + 1;
    calls.set(data.source, count);
    return { text: count === 1 ? data.source.replace(/customer group \d+/, 'a particular customer group') : data.source.replace('Build Python', 'Develop Python') };
  } });
  const client = createRewriteClient(server);
  const probe = await probeRewriteClient(client, { concurrency: 4, deadline: Date.now() + 10000 });
  assert.equal(probe.ready, true);
  assert.equal(probe.requests, 4);
  assert.equal(server.requests.length, 8);
  assert.equal(calls.size, 4);
  assert.ok([...calls.values()].every(count => count === 2));
  const fresh = await probeRewriteClient(client, { concurrency: 4, deadline: Date.now() + 10000 });
  assert.equal(fresh.ready, true);
  assert.equal(server.requests.length, 12);
});

test('cancellation during a corrective generation cannot return a rewritten description', async t => {
  const controller = new AbortController();
  const server = await serverFor(t, { complete: (data, _request, count) => {
    if (count === 2) controller.abort();
    return { text: count === 1 ? data.source.replace('2 years', '10 years') : data.source };
  } });
  await assert.rejects(createRewriteClient(server).generate(inputFor(source), { signal: controller.signal, allowSourceFallback: false }), error => error.name === 'AbortError');
  assert.equal(server.requests.length, 2);
});

test('rejected prose retains its actual completion and failing source fragment', async t => {
  const server = await serverFor(t, { complete: data => ({ text: data.source.replace('2 years', '10 years') }) });
  const response = await createRewriteClient(server).generate(inputFor(source), { allowSourceFallback: false });
  assert.match(response.rawText, /10 years/);
  assert.equal(response.validationFailure.diagnostic.evidence, 'At least 2 years of experience is required.');
  assert.match(response.validationFailure.diagnostic.text, /10 years/);
  assert.equal(response.validationFailure.diagnostic.code, 'numeric_relationship_changed');
});

test('malformed prose JSON retains the received completion on the error', async t => {
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'source prompt' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2] }));
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"text":"unfinished' } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  await assert.rejects(createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }).generate(inputFor(source)),
    error => error.rawText === '{"text":"unfinished');
});

test('all chunks share cancellation and cannot return partial success', async t => {
  const controller = new AbortController();
  const server = await serverFor(t, { complete: data => { controller.abort(); return { text: data.source }; } });
  await assert.rejects(createRewriteClient(server).generate(inputFor(source), { signal: controller.signal }), error => error.name === 'AbortError');
});

test('comparison thresholds and encoded HTML retain employer text', () => {
  const input = inputFor('Requirements:\nLatency &lt; 100 ms and throughput &gt; 200 requests per second.\nMaintain &lt;strong&gt;reliable&lt;/strong&gt; systems.');
  assert.match(proseSource(input), /Latency < 100 ms and throughput > 200/);
  assert.match(proseSource(input), /Maintain reliable systems/);
});

test('literal technical generic types survive source cleaning and validation', () => {
  const input = inputFor('Maintain C++ vector<T> utilities and compare values < 100 when testing services.');
  assert.match(proseSource(input), /vector<T>/);
  assert.equal(validateProseRewrite({ inputHash: input.inputHash, parts: [{ source: proseSource(input), text: proseSource(input) }] }, input, 'stop').ok, true);
});

test('application anchor destinations survive HTML cleanup', () => {
  const input = inputFor('Build services. Apply <a href="https://example.com/jobs/engineer">through our careers site</a>.');
  assert.match(proseSource(input), /through our careers site \(https:\/\/example.com\/jobs\/engineer\)/);
});

test('required and preferred technologies cannot exchange scope while retaining both keywords', () => {
  const input = inputFor('Requirements:\nPython is required. AWS is preferred.');
  const result = validateProseRewrite({ inputHash: input.inputHash, parts: [{ source: proseSource(input), text: 'Requirements:\nPython is preferred. AWS is required.' }] }, input, 'stop');
  assert.equal(result.ok, false);
});

test('source splitting preserves complete Unicode text without broken surrogate pairs', () => {
  const source = '🛠️'.repeat(100);
  const pieces = splitProseSource(source);
  assert.equal(pieces.join(''), source);
  assert.ok(pieces.every(piece => piece.isWellFormed()));
});

test('missing source suffixes cannot pass final validation', () => {
  const input = inputFor(source);
  assert.equal(validateProseRewrite({ inputHash: input.inputHash, parts: [{ source: 'Responsibilities:', text: 'Responsibilities:' }] }, input, 'stop').reason, 'incomplete_source');
});

test('a changed source hash cannot reuse a completed rewrite', () => {
  const input = inputFor(source);
  assert.equal(validateProseRewrite({ inputHash: 'wrong', parts: [{ source, text: source }] }, input, 'stop').reason, 'incomplete_source');
});

test('required, preferred, negated statements and application URLs retain their scope', async t => {
  for (const [original, rewrite, reason] of [
    ['Python is required.', 'Python is optional.', 'required_scope_changed'],
    ['AWS is preferred.', 'AWS is useful.', 'preferred_scope_changed'],
    ['Visa sponsorship is not available.', 'Visa sponsorship is available.', 'negation_changed'],
    ['Apply at https://example.com/job', 'Apply at https://other.example/job', 'application_url_changed'],
    ['Apply at www.example.com/careers?form=internship', 'Apply at www.example.com/careers/form/internship', 'application_url_changed'],
  ]) {
    const server = await serverFor(t, { complete: () => ({ text: rewrite }) });
    const response = await createRewriteClient(server).generate(inputFor(original), { allowSourceFallback: false });
    assert.equal(response.validationFailure?.reason, reason);
  }
});

test('validated prose caches survive restart and never apply to changed source', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-cache-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await serverFor(t);
  const options = { ...server, planCacheDir: dir }, input = inputFor(source);
  await createRewriteClient(options).generate(input);
  const cached = await createRewriteClient(options).generate(input);
  assert.equal(cached.cachedModelPlan, true);
  assert.equal(cached.generationRequests, 0);
  assert.equal(server.requests.length, 1);
  await createRewriteClient(options).generate(inputFor(source.replace('2 years', '3 years')));
  assert.equal(server.requests.length, 2);
});

test('explicit timeouts never return partial success', async t => {
  const server = await serverFor(t, { complete: async data => { await new Promise(resolve => setTimeout(resolve, 60)); return { text: data.source }; } });
  await assert.rejects(createRewriteClient({ ...server, requestMs: 20 }).generate(inputFor(source)), error => error.name === 'TimeoutError');
});

test('streamed prose has no aggregate output character ceiling across source blocks', async t => {
  const server = await serverFor(t, { stream: true });
  const response = await createRewriteClient(server).generate(inputFor('Build reliable services. '.repeat(5000)));
  assert.equal(response.finishReason, 'stop');
  assert.ok(response.value.parts.map(part => part.text).join('').length > 100000);
});

test('prose reports per-generation tokens, timings and source offsets on failures', async t => {
  const server = await serverFor(t, { complete: data => ({ text: data.source.replace('2 years', '10 years') }) });
  const response = await createRewriteClient(server).generate(inputFor(source), { allowSourceFallback: false });
  assert.equal(response.usage.completion_tokens, 80);
  assert.equal(response.timings.predicted_ms, 50);
  assert.equal(response.generations.length, 2);
  assert.equal(response.generations[0].sourceOffset, 0);
  assert.equal(response.generations[0].finishReason, 'stop');
  assert.equal(response.generations[0].validationReason, 'numeric_relationship_changed');
  assert.equal(response.generations[1].corrective, true);
  assert.ok(response.generations[0].durationMs >= 0);
});

test('validated source chunks survive client restart without publishing partial work', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-partial-cache-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let rejectSecond = true;
  const server = await serverFor(t, { tokens: prompt => prompt.length > 5000 ? 7500 : 1000,
    complete: (data, _request, count) => {
      if (rejectSecond && (count === 2 || count === 3)) return { text: '' };
      return { text: data.source.replaceAll('Build reliable', 'Develop reliable') };
    } });
  const input = inputFor('Responsibilities:\n' + 'Build reliable Python services. '.repeat(200));
  const first = await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  assert.equal(first.value, null);
  assert.equal(first.validationFailure.reason, 'empty_output');
  const firstChunk = server.requests[0].messages.at(-1).content;
  const previous = server.requests.length;
  rejectSecond = false;
  const resumed = await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  assert.equal(resumed.finishReason, 'stop');
  assert.equal(validateProseRewrite(resumed.value, input, 'stop').ok, true);
  assert.equal(resumed.value.parts.map(part => part.source).join(''), proseSource(input));
  assert.ok(server.requests.slice(previous).every(request => request.messages.at(-1).content !== firstChunk));
  assert.ok(resumed.reusedChunks > 0);
});

test('malformed text types are generation rejections with useful diagnostics', async t => {
  const server = await serverFor(t, { complete: () => ({ text: 42 }) });
  const response = await createRewriteClient(server).generate(inputFor(source));
  assert.equal(response.validationFailure.reason, 'empty_output');
  assert.equal(response.validationFailure.diagnostic.code, 'empty_output');
  assert.match(response.rawText, /42/);
});

test('runaway repetitive streams stop with a preview and cannot publish', async t => {
  const server = await serverFor(t, { stream: true,
    complete: () => ({ text: 'Build reliable services and maintain automated tests. '.repeat(300) }) });
  const input = inputFor('Build reliable services and maintain automated tests.');
  const response = await createRewriteClient(server).generate(input);
  assert.equal(response.value, null);
  assert.equal(response.validationFailure.reason, 'repetitive_output');
  assert.match(response.rawText, /Build reliable services/);
  assert.equal(response.generationRequests, 1);
  assert.equal(response.generations[0].finishReason, 'repetitive_output');
});

test('physical context splitting inside a sentence does not create false source omissions', () => {
  const source = 'Develop Python services and maintain reliable automated tests for customers across global systems without compromising reliability.';
  const input = inputFor(source);
  const pieces = splitProseSource(source);
  const result = validateProseRewrite({ inputHash: input.inputHash, parts: pieces.map(source => ({ source, text: source })) }, input, 'stop');
  assert.equal(result.ok, true);
});

test('an explicit request timeout retains the partial stream completion', async t => {
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* drain the local request */ }
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'source' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2] }));
    res.setHeader('Content-Type', 'text/event-stream');
    res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '{"text":"partial' } }] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  await assert.rejects(createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}`, requestMs: 250 }).generate(inputFor(source)),
    error => error.name === 'TimeoutError' && error.rawText === '{"text":"partial');
});

test('persistent prose cache survives a random worker alias change', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-stable-alias-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await serverFor(t);
  const input = inputFor(source);
  await createRewriteClient({ ...server, model: 'worker-alias-one', planCacheDir: dir }).generate(input);
  const result = await createRewriteClient({ ...server, model: 'worker-alias-two', planCacheDir: dir }).generate(input);
  assert.equal(result.cachedModelPlan, true);
  assert.equal(result.generationRequests, 0);
  assert.equal(server.requests.length, 1);
});

test('identical effective source reuses cache while binding the current job input hash', async t => {
  const server = await serverFor(t);
  const client = createRewriteClient(server);
  const first = inputFor(source);
  const second = buildRewriteInput({ title: 'Senior Engineer', company: 'Another employer', sourceDescription: source });
  assert.notEqual(first.inputHash, second.inputHash);
  await client.generate(first);
  const result = await client.generate(second);
  assert.equal(result.cachedModelPlan, true);
  assert.equal(result.value.inputHash, second.inputHash);
  assert.equal(validateProseRewrite(result.value, second, 'stop').ok, true);
  assert.equal(validateProseRewrite(result.value, first, 'stop').ok, false);
  assert.equal(server.requests.length, 1);
});

test('changed location rebuilds source metadata while reusing only the unchanged validated prose', async t => {
  const server = await serverFor(t), client = createRewriteClient(server);
  await client.generate(buildRewriteInput({ title: 'Engineer', sourceDescription: source, location: 'Pune' }));
  const previous = server.requests.length;
  const result = await client.generate(buildRewriteInput({ title: 'Engineer', sourceDescription: source, location: 'Mumbai' }));
  assert.equal(server.requests.length, previous);
  assert.ok(result.reusedChunks > 0);
  assert.equal(result.cachedModelPlan, undefined);
  assert.match(validateProseRewrite(result.value, buildRewriteInput({ title: 'Engineer', sourceDescription: source, location: 'Mumbai' }), 'stop').description, /Location: Mumbai/);
  assert.doesNotMatch(validateProseRewrite(result.value, buildRewriteInput({ title: 'Engineer', sourceDescription: source, location: 'Mumbai' }), 'stop').description, /Location: Pune/);
});

test('simultaneous identical sources share one inference and preserve every job hash', async t => {
  const server = await serverFor(t, { complete: async data => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { text: data.source.replace('Build reliable', 'Develop reliable') };
  } });
  const client = createRewriteClient(server);
  const inputs = Array.from({ length: 4 }, (_v, index) => buildRewriteInput({ title: 'Engineer ' + index, sourceDescription: source }));
  const results = await Promise.all(inputs.map(input => client.generate(input)));
  assert.equal(server.requests.length, 1);
  assert.equal(results.reduce((sum, result) => sum + result.generationRequests, 0), 1);
  assert.equal(results.filter(result => result.sharedGeneration).length, 3);
  for (const [index, result] of results.entries()) assert.equal(validateProseRewrite(result.value, inputs[index], 'stop').ok, true);
});

test('one cancelled duplicate cannot abort another job waiting for the same inference', async t => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const server = await serverFor(t, { complete: async data => {
    began(); await new Promise(resolve => setTimeout(resolve, 50));
    return { text: data.source };
  } });
  const client = createRewriteClient(server), controller = new AbortController();
  const first = client.generate(inputFor(source), { signal: controller.signal });
  const rejected = assert.rejects(first, error => error.name === 'AbortError');
  await started;
  const second = client.generate(inputFor(source));
  controller.abort();
  await rejected;
  const result = await second;
  assert.equal(result.finishReason, 'stop');
  assert.equal(server.requests.length, 1);
  assert.equal(result.generationRequests, 1);
});

test('refresh mode measures fresh inference even when an accepted rewrite is cached', async t => {
  const server = await serverFor(t), client = createRewriteClient(server), input = inputFor(source);
  await client.generate(input);
  const fresh = await client.generate(input, { cacheMode: 'refresh' });
  assert.equal(fresh.generationRequests, 1);
  assert.equal(fresh.cachedModelPlan, undefined);
  assert.equal(server.requests.length, 2);
  const cached = await client.generate(input);
  assert.equal(cached.generationRequests, 0);
  assert.equal(server.requests.length, 2);
});

test('cancelling every duplicate removes the abandoned work and permits a fresh request', async t => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  const server = await serverFor(t, { complete: async data => {
    began(); await new Promise(resolve => setTimeout(resolve, 50)); return { text: data.source };
  } });
  const client = createRewriteClient(server), first = new AbortController(), second = new AbortController();
  const a = client.generate(inputFor(source), { signal: first.signal });
  const b = client.generate(inputFor(source), { signal: second.signal });
  const rejected = Promise.all([assert.rejects(a, error => error.name === 'AbortError'), assert.rejects(b, error => error.name === 'AbortError')]);
  await started; first.abort(); second.abort(); await rejected;
  const result = await client.generate(inputFor(source));
  assert.equal(validateProseRewrite(result.value, inputFor(source), 'stop').ok, true);
  assert.equal(server.requests.length, 2);
});

test('a corrupt persistent cache is revalidated instead of publishing altered content', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-corrupt-cache-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await serverFor(t), input = inputFor(source);
  await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  const name = (await fs.readdir(dir)).find(name => name.endsWith('.json'));
  const file = path.join(dir, name), value = JSON.parse(await fs.readFile(file, 'utf8'));
  value.parts[0].text = 'Invented Java responsibilities.';
  await fs.writeFile(file, JSON.stringify(value));
  const result = await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  assert.equal(server.requests.length, 2);
  assert.equal(result.cachedModelPlan, undefined);
  assert.equal(validateProseRewrite(result.value, input, 'stop').ok, true);
});

test('a malformed cached parts container is ignored so fresh generation can recover', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-invalid-parts-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await serverFor(t), input = inputFor('Build reliable Python services.');
  await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  const file = path.join(dir, (await fs.readdir(dir)).find(name => name.endsWith('.json')));
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  value.parts = {};
  await fs.writeFile(file, JSON.stringify(value));
  const response = await createRewriteClient({ ...server, planCacheDir: dir }).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(response.cachedModelPlan, undefined);
  assert.equal(server.requests.length, 2);
});

test('a bold trailing heading is retained as original source and cannot poison partial reuse', async t => {
  const server = await serverFor(t, { complete: data => ({ text: data.source + '\n**Required qualifications**' }) });
  const client = createRewriteClient(server), input = inputFor('Build Python services.\nLocation: Pune');
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.generate(input);
    const checked = validateProseRewrite(response.value, input, 'stop');
    assert.equal(checked.ok, true);
    assert.equal(checked.quality.sourceFallbackBlocks, 1);
    assert.doesNotMatch(checked.description, /Required qualifications/);
    assert.equal(response.generationRequests, 2);
  }
});

test('a duplicate timeout before the first response frame does not double-count inference', async t => {
  const server = await serverFor(t, { complete: async data => {
    await new Promise(resolve => setTimeout(resolve, 150)); return { text: data.source };
  } });
  const client = createRewriteClient(server), input = inputFor(source);
  let timeout;
  const first = client.generate(input, { remainingMs: 80 });
  const rejected = assert.rejects(first, error => { timeout = error; return error.name === 'TimeoutError'; });
  const survivor = client.generate(input, { remainingMs: 1000 });
  await rejected;
  const result = await survivor;
  assert.equal(timeout.generationRequests, 0);
  assert.equal(result.generationRequests, 1);
  assert.equal(server.requests.length, 1);
});
