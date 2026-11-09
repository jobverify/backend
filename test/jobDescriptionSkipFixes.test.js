import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { assessRewriteInput, buildSourceFacts, validateFactPlan } from '../rewriting/factPlan.js';
import { createRewriteClient as createProductionRewriteClient } from '../rewriting/runner.js';
const createRewriteClient = options => createProductionRewriteClient({ ...options, format: 'fact-plan' });

const inputFor = sourceDescription => buildRewriteInput({ title: 'Engineer', sourceDescription });
const validate = input => validateFactPlan({ categories: buildSourceFacts(input).map(f => f.section ?? 9) }, input, 'stop');

test('encoded HTML formatting is cleaned while employer text and boundaries survive', () => {
  const input = inputFor('Responsibilities:\nBuild &lt;strong&gt;reliable&lt;/strong&gt; customer software and maintain services.\nTest &lt;em&gt;critical&lt;/em&gt; systems and support customer projects.\nRequirements:\nA Bachelor degree or equivalent experience is required for this engineering role.');
  assert.equal(assessRewriteInput(input).ok, true);
  const result = validate(input);
  assert.equal(result.ok, true);
  assert.match(result.description, /reliable/);
  assert.doesNotMatch(result.description, /&lt;|<strong|<em/);
});

test('plain single-section duties can gain bullet formatting without invented facts', () => {
  const input = inputFor('Responsibilities:\nBuild reliable customer applications and collaborate with engineering teams on software delivery.\nTest critical services and maintain clear technical documentation for customer support teams.');
  assert.equal(assessRewriteInput(input).ok, true);
  const result = validate(input);
  assert.equal(result.ok, true);
  assert.equal(result.quality.factCoverage, 1);
  assert.match(result.description, /- Build reliable/);
});

test('a lone fact still does not earn a formatting improvement', () => {
  const input = inputFor('Responsibilities:\nBuild reliable customer applications and collaborate with engineering teams across the organization to deliver useful software solutions for global enterprise customer projects and internal business services');
  assert.equal(assessRewriteInput(input).reason, 'not_improved');
});

test('more than 128 labelled facts are preserved in full', () => {
  const input = inputFor('Responsibilities:\n' + Array.from({ length: 140 }, (_, i) => `Build reliable customer feature ${i} and maintain its tests.`).join('\n') + '\nRequirements:\nA Bachelor degree or equivalent engineering experience is required.');
  assert.equal(input.eligible, true);
  assert.equal(assessRewriteInput(input).ok, true);
  const result = validate(input);
  assert.equal(result.ok, true);
  for (let i = 0; i < 140; i++) assert.ok(result.description.includes(`feature ${i} and`));
});

test('large compact plans batch unknown decisions, size prompts and preserve all facts', async t => {
  let generations = 0, tokenizations = 0;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(request.messages) }));
    if (req.url === '/tokenize') { tokenizations++; return res.end(JSON.stringify({ tokens: Array(500).fill(1) })); }
    generations++;
    const data = JSON.parse(request.messages[1].content);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ categories: data.unlabelledFacts.map(() => 1), overviewFactId: data.overviewFacts.length ? 0 : null }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const input = inputFor(Array.from({ length: 150 }, (_, i) => `Build reliable customer feature ${i} and maintain its tests.`).join('\n') + '\nRequirements:\nA Bachelor degree or equivalent engineering experience is required.');
  const result = await createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }).generate(input);
  const checked = validateFactPlan(result.value, input, result.finishReason);
  assert.equal(checked.ok, true);
  assert.ok(generations > 1);
  assert.equal(tokenizations, generations);
  assert.equal(result.generationRequests, generations);
  for (let i = 0; i < 150; i++) assert.ok(checked.description.includes(`feature ${i} and`));
});

test('nested numeric HTML entities cannot leave active markup in extracted facts', () => {
  const input = inputFor('Responsibilities:\nBuild &amp;#60;strong&amp;#62;reliable&amp;#60;/strong&amp;#62; customer applications and maintain services.\nTest critical systems and support engineering teams.\nRequirements:\nA Bachelor degree or equivalent engineering experience is required.');
  assert.equal(assessRewriteInput(input).ok, true);
  const result = validate(input);
  assert.equal(result.ok, true);
  assert.match(result.description, /reliable/);
  assert.doesNotMatch(result.description, /<\/?strong|&#60;/);
});

test('empty extraction reports insufficient source rather than too many facts', () => {
  const input = inputFor('Responsibilities:\n'.repeat(30));
  assert.equal(input.eligible, true);
  assert.equal(assessRewriteInput(input).reason, 'insufficient_source');
});

test('an already bulleted single section still retains its original source', () => {
  const input = inputFor('Responsibilities:\n- Build reliable customer applications and collaborate with engineering teams on software delivery.\n- Test critical services and maintain clear technical documentation for customer support teams.');
  assert.equal(assessRewriteInput(input).reason, 'not_improved');
});

test('decoded comparison operators preserve every threshold and relationship', () => {
  const input = inputFor('Requirements:\nCandidates must have experience with pipelines handling latency &lt; 100 ms and throughput &gt; 200 requests per second.\nA Bachelor degree in engineering or equivalent practical experience is required for this role.');
  const result = validate(input);
  assert.equal(result.ok, true);
  assert.match(result.description, /latency < 100 ms and throughput > 200 requests per second/);
});

test('an already numbered single section retains its source without orphan number bullets', () => {
  const input = inputFor('Responsibilities:\n1. Build reliable customer applications and collaborate with engineering teams on software delivery.\n2. Test critical services and maintain clear technical documentation for customer support teams.');
  assert.equal(assessRewriteInput(input).reason, 'not_improved');
  assert.equal(validate(input).reason, 'not_improved');
});

const largeInput = () => inputFor(Array.from({ length: 80 }, (_, i) => `Build reliable customer feature ${i} and maintain its tests.`).join('\n') + '\nRequirements:\nA Bachelor degree or equivalent engineering experience is required.');
const batchServer = async (t, { tokens = () => 500, complete = () => null } = {}) => {
  let generations = 0;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(request.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: Array(tokens(JSON.parse(JSON.parse(request.content)[1].content))).fill(1) }));
    generations++;
    const data = JSON.parse(request.messages[1].content);
    const custom = await complete(generations, data);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(custom || { categories: data.unlabelledFacts.map(() => 1), overviewFactId: data.overviewFacts.length ? 0 : null }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, count: () => generations };
};

test('token context overflow splits batches further without dropping source facts', async t => {
  const server = await batchServer(t, { tokens: data => data.unlabelledFacts.length > 4 ? 8192 : 500 });
  const input = largeInput();
  const response = await createRewriteClient(server).generate(input);
  const result = validateFactPlan(response.value, input, response.finishReason);
  assert.equal(result.ok, true);
  assert.equal(server.count(), 20);
  assert.equal(response.generationRequests, 20);
  for (let i = 0; i < 80; i++) assert.ok(result.description.includes(`feature ${i} and`));
});

test('a single fact exceeding the token budget is rejected before generation', async t => {
  const server = await batchServer(t, { tokens: () => 8192 });
  await assert.rejects(createRewriteClient(server).generate(largeInput()), error => error.reason === 'model_context_budget' && error.generationRequests === 0);
  assert.equal(server.count(), 0);
});

test('a malformed later batch never produces a publishable partial description', async t => {
  const server = await batchServer(t, { complete: count => count === 2 ? { categories: [], overviewFactId: null } : null });
  const input = largeInput();
  const response = await createRewriteClient(server).generate(input);
  assert.equal(response.value, null);
  assert.equal(response.generationRequests, 2);
  assert.equal(validateFactPlan(response.value, input, response.finishReason).ok, false);
});

test('batches share the original request timeout and report requests already started', async t => {
  const server = await batchServer(t, { complete: async () => { await new Promise(resolve => setTimeout(resolve, 80)); } });
  await assert.rejects(createRewriteClient({ ...server, requestMs: 200 }).generate(largeInput()), error => error.name === 'TimeoutError' && error.generationRequests >= 1);
  assert.ok(server.count() < 5);
});
