import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRewriteInput, validateRewrite, REWRITE_MODEL } from '../src/services/jobDescriptionPolicy.js';
import { buildReferencedSections, expandReferencedSections } from '../rewriting/sectionProtocol.js';
import { createRewriteClient as createProductionRewriteClient, rewriteCandidates } from '../rewriting/runner.js';
// Historical v13 transport remains replayable independently of production defaults.
const createRewriteClient = options => createProductionRewriteClient({ ...options, format: 'source-sections' });

const overview = 'Build Python services for customer applications.';
const duty = 'Design reliable APIs and maintain Python services.';
const required = 'At least 2 years of software development experience is required.';
const preferred = 'AWS experience is nice to have.';
const job = () => {
  const value = { _id: 'source-ids', title: 'Software Engineer', company: 'Example', status: 'active',
    sourceDescription: `Role overview: ${overview} Responsibilities: ${duty} Required qualifications: ${required} Preferred qualifications: ${preferred}`,
    descriptionRewrite: { status: 'pending', attempts: 0 } };
  value.sourceContentHash = value.descriptionRewrite.inputHash = buildRewriteInput(value).inputHash;
  return value;
};
const sourceId = (protocol, text) => protocol.sources.find(item => item.text === text).id;

test('source IDs remove repeated evidence and sensitive facts render verbatim in their original scope', () => {
  const input = buildRewriteInput(job()), protocol = buildReferencedSections(input);
  const raw = { sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] },
    { key: 'preferred', items: [{ source: sourceId(protocol, required), text: 'At least 10 years is preferred.' }] }] };
  const expanded = expandReferencedSections(raw, input);
  const checked = validateRewrite(expanded, input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /## Required qualifications\n\n- At least 2 years/);
  assert.match(checked.description, /## Preferred qualifications and skills\n\n- AWS/);
  assert.match(checked.description, /Design reliable APIs/);
  assert.doesNotMatch(checked.description, /10 years/);
  assert.doesNotMatch(JSON.stringify(protocol.schema), /evidence|style/);
  assert.equal(JSON.parse(protocol.messages[1].content).sources.length, protocol.sources.length);
});

test('source references reject unknown IDs and unsupported unprotected prose', () => {
  const input = buildRewriteInput(job()), protocol = buildReferencedSections(input);
  assert.equal(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: 99999 }] }] }, input), null);
  const value = expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview), text: overview + ' Kubernetes expertise.' }] }] }, input);
  assert.equal(validateRewrite(value, input, 'stop').ok, false);
});

test('conditional employment and short original bullets survive without model repetition', () => {
  const value = job(); value.sourceDescription += ' Employment details: Remote work is available after probation.';
  value.sourceDescription = value.sourceDescription.replace(duty, duty + ' Use Git.');
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Remote work is available after probation\./);
  assert.match(checked.description, /Use Git\./);
});

test('an overview cannot replace a required duty; a title overview retains both', () => {
  const value = job(); value.sourceDescription = value.sourceDescription.replace(`Role overview: ${overview} `, '');
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, duty) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /## Role overview\n\nSoftware Engineer/);
  assert.match(checked.description, /## Responsibilities\n\n- Design reliable APIs/);
});

test('automatic detail retention supports more than sixteen responsibilities', () => {
  const value = job(), duties = Array.from({ length: 17 }, (_, index) => `Maintain service component ${index + 1} reliably.`);
  value.sourceDescription = value.sourceDescription.replace(duty, duties.join(' '));
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  for (const statement of duties) assert.ok(checked.description.includes(statement));
});

test('coordinated preferred technologies cannot be made mandatory by an inherited heading', () => {
  const value = job(); value.sourceDescription += ' Required skills: Python and Java experience is preferred.';
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /## Preferred qualifications and skills[\s\S]*Python and Java experience is preferred\./);
  assert.ok(!protocol.sources.some(unit => unit.text === 'Python' && unit.scope === 'required'));
});

test('metadata references keep their own provenance alongside a longer conditional statement', () => {
  const value = { ...job(), location: 'Pune' }; value.sourceDescription += ' Employment details: Work in Pune after probation.';
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Work in Pune after probation\./);
  assert.match(checked.description, /- Pune/);
});

test('plain unheaded descriptions retain substantive source facts when the model selects only the title', () => {
  const value = job(); value.sourceDescription = 'Build Python services for customer applications. Design reliable APIs and maintain Python services. Diagnose production incidents using employer dashboards. Document deployment steps and review release changes with colleagues.';
  const input = buildRewriteInput(value), protocol = buildReferencedSections(input);
  const checked = validateRewrite(expandReferencedSections({ sections: [{ key: 'overview', items: [{ source: sourceId(protocol, value.title) }] }] }, input), input, 'stop');
  assert.equal(checked.ok, true);
  assert.match(checked.description, /Diagnose production incidents/);
  assert.match(checked.description, /Document deployment steps/);
  assert.match(checked.description, /Design reliable APIs/);
});

test('production client uses the compact source protocol and publishes through the guarded update', async t => {
  const value = job(), input = buildRewriteInput(value), protocol = buildReferencedSections(input), requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body); res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'template' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1,2,3] }));
    requests.push(request);
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sections: [
      { key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = createRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port });
  let saved;
  const stats = await rewriteCandidates([value], { client, deadline: Date.now() + 10000,
    update: async (filter, update) => { saved = { filter, update }; return { matchedCount: 1 }; } });
  assert.equal(client.format, 'source-sections');
  assert.equal(requests[0].max_tokens, REWRITE_MODEL.maxOutputTokens); assert.equal(stats.published, 1);
  assert.equal(saved.filter.sourceContentHash, value.sourceContentHash);
  assert.equal(saved.update.$set.sourceDescription, undefined);
  assert.match(saved.update.$set.description, /At least 2 years/);
  assert.equal((await client.generate(input)).generationRequests, 0);
});

const sourceServer = async (t, complete) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const request = JSON.parse(body); res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'template' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1,2,3] }));
    requests.push(request);
    const output = complete(request, requests.length);
    res.end(JSON.stringify({ choices: [{ finish_reason: output.finishReason || 'stop', message: { content: JSON.stringify(output.value) } }],
      usage: output.usage, timings: output.timings }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { requests, endpoint: 'http://127.0.0.1:' + server.address().port };
};

test('source-ID caches reuse only the exact original source and current salary', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'source-id-cache-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const server = await sourceServer(t, request => {
    const sources = JSON.parse(request.messages[1].content).sources;
    return { value: { sections: [{ key: 'overview', items: [{ source: sources.find(unit => unit.text === overview).id }] }] } };
  });
  const options = { ...server, planCacheDir: directory }, client = createRewriteClient(options);
  const a = buildRewriteInput({ ...job(), salary: 'INR 321000 per year' }), b = buildRewriteInput({ ...job(), salary: 'INR 400000 per year' });
  await client.generate(a);
  assert.equal((await client.generate(a)).cacheSource, 'memory');
  assert.equal((await createRewriteClient(options).generate(a)).cacheSource, 'disk');
  const changed = await client.generate(b);
  assert.equal(server.requests.length, 2); assert.equal(changed.cachedModelPlan, undefined);
  assert.match(JSON.stringify(changed.value), /400000/); assert.doesNotMatch(JSON.stringify(changed.value), /321000/);
});

test('a retry is skipped when measured generation speed cannot fit the original deadline', async t => {
  const input = buildRewriteInput(job()), protocol = buildReferencedSections(input);
  const server = await sourceServer(t, () => ({ finishReason: 'length',
    value: { sections: [{ key: 'overview', items: [{ source: sourceId(protocol, overview) }] }] },
    usage: { completion_tokens: 1024 }, timings: { predicted_per_token_ms: 200, prompt_ms: 60000 } }));
  const response = await createRewriteClient({ ...server, requestMs: 10000 }).generate(input);
  assert.equal(server.requests.length, 1); assert.equal(response.retrySkipped, 'insufficient_time');
  assert.equal(response.finishReason, 'length'); assert.equal(response.generationRequests, 1);
});
