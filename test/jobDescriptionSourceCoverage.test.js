import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildRewriteInput, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, probeRewriteClient, rewriteCandidates, rewriteProgress } from '../rewriting/runner.js';
import { validateProseRewrite } from '../rewriting/prose.js';
import Job from '../src/models/Job.js';

const inputFor = sourceDescription => buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription });
const serverFor = async (t, complete) => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let text = ''; for await (const part of request) text += part;
    const body = JSON.parse(text);
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/apply-template') return response.end(JSON.stringify({ prompt: JSON.stringify(body.messages) }));
    if (request.url === '/tokenize') return response.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests.push(body);
    const source = body.messages.at(-1).content;
    const completion = await complete(source, requests.length);
    response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text: completion }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, requests };
};

test('omitted responsibilities retain their original source beside accepted model edits', async t => {
  const source = 'Role overview:\nBuild Python services.\nResponsibilities:\nMaintain automated tests.\nLocation: Pune\nTime Type: Full time';
  const server = await serverFor(t, text => text.includes('Build Python') ? 'Develop Python services.' : 'Short summary.');
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Develop Python services/);
  assert.match(checked.description, /Maintain automated tests/);
  assert.match(checked.description, /Location: Pune/);
  assert.match(checked.description, /Time Type: Full time/);
  assert.equal(checked.quality.modelEditedBlocks, 1);
  assert.equal(checked.quality.sourceFallbackBlocks, 1);
  assert.equal(checked.quality.fullSourceCoverage, true);
  assert.ok(checked.quality.protectedSourceBlocks >= 2);
  assert.equal(response.value.parts.map(part => part.source).join(''), source);
});

test('embedded position and employment metadata never depend on model generation', async t => {
  const source = 'Position: Python Engineer Job Description: Location: Pune Time Type: Full time Job Category: Engineering Services';
  const server = await serverFor(t, () => 'Python Engineer.');
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Position: Python Engineer/);
  assert.match(checked.description, /Location: Pune/);
  assert.match(checked.description, /Time Type: Full time/);
  assert.match(checked.description, /Job Category: Engineering Services/);
  assert.equal(server.requests.length, 0);
  assert.equal(response.generationRequests, 0);
  assert.equal(response.renderedWithoutInference, true);
  assert.equal(checked.quality.modelEditedBlocks, 0);
  assert.equal(checked.quality.outcome, 'metadata_only');
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
});

test('a neutral paragraph may change line layout without losing actors or actions', async t => {
  const server = await serverFor(t, () => 'Design reliable APIs.\nMaintain automated tests.');
  const input = inputFor('Responsibilities:\nDesign reliable APIs. Maintain automated tests.');
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
  assert.match(checked.description, /Maintain automated tests/);
});

test('a model cannot leave a required heading that changes the next source block', async t => {
  const source = 'Responsibilities:\nBuild Python services.\n\nMaintain automated tests.';
  const server = await serverFor(t, text => text.includes('Build Python') ? 'Develop Python services.\n## Required qualifications' : text);
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.doesNotMatch(checked.description, /Required qualifications/);
  assert.match(checked.description, /Build Python services/);
  assert.equal(checked.quality.sourceFallbackBlocks, 1);
});

test('numbers, negation and preferred scope are validated after attempting inference', async t => {
  const source = 'Required qualifications:\nAt least 2 years of Python experience is required.\nPreferred qualifications:\nAWS experience is nice-to-have.\nEmployment details:\nNo visa sponsorship is available.';
  const server = await serverFor(t, () => 'At most 10 years is required. Visa sponsorship is available.');
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.match(checked.description, /At least 2 years of Python experience is required/);
  assert.match(checked.description, /AWS experience is nice-to-have/);
  assert.match(checked.description, /No visa sponsorship is available/);
  assert.ok(server.requests.length > 0);
  assert.ok(checked.quality.sourceFallbackBlocks > 0);
  assert.equal(checked.quality.outcome, 'source_fallback');
});

test('the Sattva internship body receives bounded inference despite numbers and negation', async t => {
  const source = (await readFile(new URL('./test-data/descriptions/sattva-internship.txt', import.meta.url), 'utf8')).trim();
  const server = await serverFor(t, text => text.replaceAll('. ', '.\n\n'));
  const input = buildRewriteInput({ title: 'Sattva Internship Form', company: 'Sattva Media', sourceDescription: source });
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.ok(response.generationRequests > 0);
  assert.ok(server.requests.every(request => request.messages.at(-1).content.length <= 900));
  assert.ok(server.requests.some(request => /25 countries and 5 continents/.test(request.messages.at(-1).content)));
  assert.ok(server.requests.some(request => /no story|not just/.test(request.messages.at(-1).content)));
  // Source spans use LF even when Git checks this text fixture out with CRLF.
  assert.equal(response.value.parts.map(part => part.source).join(''), source.replace(/\r\n?/g, '\n'));
  assert.match(checked.description, /25 countries and 5 continents/);
  assert.match(checked.description, /no story should go unheard/);
  assert.match(checked.description, /www\.sattva\.co\.in/);
  assert.match(checked.description, /Location: Bengaluru \[India\]/);
  assert.match(checked.description, /\n\n/);
  assert.equal(checked.quality.outcome, 'model_edited');
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
});

test('conditional prose can be edited while preserving its numeric and required facts', async t => {
  const source = 'If you enjoy media, build content for 3 months. No experience is required.';
  const server = await serverFor(t, text => text.replace('build content', 'develop content'));
  const input = inputFor(source);
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.ok(response.generationRequests > 0);
  assert.match(checked.description, /develop content for 3 months/);
  assert.match(checked.description, /No experience is required/);
  assert.equal(checked.quality.outcome, 'model_edited');
});

test('an unchanged model response is explicitly identified as source preservation', async t => {
  const server = await serverFor(t, text => text);
  const input = inputFor('If you enjoy media, build content for 3 months.');
  const response = await createRewriteClient(server).generate(input);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.ok(response.generationRequests > 0);
  assert.equal(checked.quality.modelEditedBlocks, 0);
  assert.equal(checked.quality.outcome, 'source_preserved');
  const stored = new Job({ descriptionRewrite: { quality: checked.quality } }).toObject();
  assert.equal(stored.descriptionRewrite.quality.outcome, 'source_preserved');
});

test('an accepted v24 source-copy cache cannot bypass current-policy inference', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prose-v24-copy-'));
  t.after(async () => {
    for (const file of await fs.readdir(directory)) await fs.unlink(path.join(directory, file));
    await fs.rmdir(directory);
  });
  const source = 'If you enjoy media, build content for 3 months.';
  const input = inputFor(source), sourceHash = createHash('sha256').update(source).digest('hex');
  const legacyModel = { ...REWRITE_MODEL, policyVersion: 'job-description-prose-v24' };
  const legacyKey = createHash('sha256').update(JSON.stringify(['prose-source-cache-v3', legacyModel, sourceHash, true])).digest('hex');
  await fs.writeFile(path.join(directory, legacyKey + '.json'), JSON.stringify({ inputHash: input.inputHash, sourceHash,
    parts: [{ source, text: source, sourceOffset: 0, protected: 'facts' }] }));
  const server = await serverFor(t, text => text.replace('build content', 'develop content'));
  const response = await createRewriteClient({ ...server, planCacheDir: directory }).generate(input);
  assert.ok(response.generationRequests > 0);
  assert.notEqual(response.cachedModelPlan, true);
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.equal(checked.quality.outcome, 'model_edited');
});

test('source offsets and fallback contents are revalidated before a cached value can publish', async t => {
  const server = await serverFor(t, text => text.replace('Build Python', 'Develop Python'));
  const input = inputFor('Build Python services.\nLocation: Pune');
  const response = await createRewriteClient(server).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  const changedOffset = structuredClone(response.value);
  changedOffset.parts[0].sourceOffset = 1;
  assert.equal(validateProseRewrite(changedOffset, input, 'stop').ok, false);
  const inventedFallback = structuredClone(response.value);
  inventedFallback.parts[0].origin = 'source_fallback';
  inventedFallback.parts[0].text = 'Build Kubernetes services for 100 customers.';
  assert.equal(validateProseRewrite(inventedFallback, input, 'stop').ok, false);
});

test('readiness cannot be satisfied by original-source fallback for rejected model output', async t => {
  const server = await serverFor(t, () => 'Invented Kubernetes duties.');
  const probe = await probeRewriteClient(createRewriteClient(server), { concurrency: 4, deadline: Date.now() + 10000 });
  assert.equal(probe.ready, false);
  assert.equal(probe.warnings, 4);
});

test('fallback output is attempted again instead of becoming a permanent accepted cache entry', async t => {
  let reject = true;
  const server = await serverFor(t, text => reject ? 'Unrelated employer text.' : text.replace('Build Python', 'Develop Python'));
  const client = createRewriteClient(server), input = inputFor('Build Python services.');
  const first = await client.generate(input);
  const firstChecked = validateProseRewrite(first.value, input, 'stop');
  assert.equal(firstChecked.ok, true);
  assert.equal(firstChecked.quality.sourceFallbackBlocks, 1);
  const previous = server.requests.length;
  reject = false;
  const second = await client.generate(input);
  const checked = validateProseRewrite(second.value, input, 'stop');
  assert.equal(checked.ok, true);
  assert.equal(checked.quality.sourceFallbackBlocks, 0);
  assert.match(checked.description, /Develop Python/);
  assert.ok(server.requests.length > previous);
});

test('published fallback metrics are persisted and counted as warnings without changing pending estimates', async t => {
  const source = 'Build Python services.';
  const server = await serverFor(t, () => 'Unrelated employer text.');
  const input = inputFor(source);
  let saved;
  const stats = await rewriteCandidates([{ _id: 'coverage', status: 'active', title: 'Engineer', company: 'Example', sourceDescription: source,
    sourceContentHash: input.inputHash, descriptionRewrite: { status: 'pending', attempts: 0, inputHash: input.inputHash } }], {
    client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; },
  });
  assert.equal(stats.published, 1);
  assert.equal(stats.sourceFallbackDescriptions, 1);
  assert.equal(stats.sourceFallbackBlocks, 1);
  assert.equal(rewriteProgress({ queued: 1, ...stats }).pendingEstimate, 0);
  assert.equal(rewriteProgress({ queued: 1, ...stats }).warnings, 1);
  const stored = new Job({ descriptionRewrite: { quality: saved.$set['descriptionRewrite.quality'] } }).toObject();
  assert.equal(stored.descriptionRewrite.quality.sourceFallbackBlocks, 1);
  assert.equal(stored.descriptionRewrite.quality.fullSourceCoverage, true);
});

test('Sattva source fallback is displayed as readable paragraphs without being counted as a model edit', async t => {
  const source = await readFile(new URL('./test-data/descriptions/sattva-internship.txt', import.meta.url), 'utf8');
  const input = inputFor(source);
  const server = await serverFor(t, () => 'Unrelated employer text.');
  const response = await createRewriteClient(server).generate(input);
  const result = validateProseRewrite(response.value, input, 'stop');
  assert.equal(result.ok, true);
  assert.ok(result.quality.layoutParagraphBreaks >= 2);
  assert.ok(result.description.split('\n\n').length >= 3);
  assert.equal(result.description.replace(/\s+/g, ' '), source.trim().replace(/\s+/g, ' '));
  assert.match(result.description, /25 countries and 5 continents/);
  assert.match(result.description, /www\.sattva\.co\.in/);
  assert.match(result.description, /Please avoid reaching out to any individual from Sattva/);
  assert.match(result.description, /Location: Bengaluru \[India\]/);
  assert.equal(result.quality.modelEditedBlocks, 0);
  assert.ok(result.quality.sourceFallbackBlocks > 0);
  assert.equal(result.quality.outcome, 'source_fallback');
  assert.ok(response.value.parts.filter(part => part.fallbackReason).every(part => part.text === part.source));
  const stored = new Job({ descriptionRewrite: { quality: result.quality } }).toObject();
  assert.equal(stored.descriptionRewrite.quality.layoutParagraphBreaks, result.quality.layoutParagraphBreaks);
});

test('existing Markdown paragraphs and long list items retain their layout', () => {
  const source = '## Responsibilities\n\n- ' + 'Build reliable Python services. '.repeat(24) + '\n\nLocation: Pune';
  const input = inputFor(source);
  const result = validateProseRewrite({ inputHash: input.inputHash, parts: [{ source, text: source }] }, input, 'stop');
  assert.equal(result.ok, true);
  assert.equal(result.description, source);
  assert.equal(result.quality.layoutParagraphBreaks, 0);
});

for (const [name, output, wording, layout] of [
  ['paragraph formatting', '- Build reliable Python services.\n- Maintain automated tests.', 0, 1],
  ['wording changes', 'Develop reliable Python services. Maintain automated tests.', 1, 0],
]) test(`quality distinguishes model ${name} from server paragraph formatting`, async t => {
  const input = inputFor('Build reliable Python services. Maintain automated tests.');
  const server = await serverFor(t, () => output);
  const response = await createRewriteClient(server).generate(input);
  const result = validateProseRewrite(response.value, input, 'stop');
  assert.equal(result.ok, true);
  assert.equal(result.quality.modelEditedBlocks, 1);
  assert.equal(result.quality.modelWordingEditedBlocks, wording);
  assert.equal(result.quality.modelLayoutEditedBlocks, layout);
  assert.equal(result.quality.layoutParagraphBreaks, 0);
});

test('final assembly preserves long indented Markdown list continuations', () => {
  const source = '- Implement customer workflows.\n  ' + 'Build reliable Python services. '.repeat(25).trim();
  const input = inputFor(source);
  const result = validateProseRewrite({ inputHash: input.inputHash, parts: [{ source, text: source }] }, input, 'stop');
  assert.equal(result.ok, true);
  assert.equal(result.description, source);
  assert.equal(result.quality.layoutParagraphBreaks, 0);
});
