import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRewriteClient as createProductionRewriteClient, rewriteCandidates, rewriteProgress } from '../rewriting/runner.js';
import { REWRITE_MODEL, REWRITE_SCHEMA, buildRewriteInput, validateRewrite } from '../src/services/jobDescriptionPolicy.js';
import { auditDescriptionCase } from '../rewriting/auditDescriptionRun.js';
// Keep the prior evidence-text protocol covered; v13 source IDs have separate coverage.
const createRewriteClient = options => createProductionRewriteClient({ ...options, format: 'sections' });

const overview = 'Build Python services for customer applications.';
const responsibility = 'Design reliable APIs and maintain Python services.';
const required = 'At least 2 years of software development experience is required.';
const preferred = 'AWS experience is nice to have.';
const source = `Role overview: ${overview} Responsibilities: ${responsibility} Required qualifications: ${required} Preferred qualifications: ${preferred}`;
const section = (key, text, evidence = text) => ({ key, items: [{ text, evidence, style: 'bullet' }] });
const valid = () => ({ sections: [section('overview', overview), section('responsibilities', responsibility),
  section('required_qualifications', required), section('preferred', preferred)] });
const candidate = (extra = {}) => {
  const job = { _id: 'qwen-source', title: 'Software Engineer', company: 'Example', status: 'active',
    sourceDescription: source, descriptionRewrite: { status: 'pending', attempts: 0 }, ...extra };
  job.sourceContentHash = job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
  return job;
};
const localServer = async (t, { promptTokens = 1000, complete } = {}) => {
  const requests = [], metadata = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') {
      metadata.push({ route: req.url, request });
      res.end(JSON.stringify({ prompt: 'rendered chat with special tokens' }));
    } else if (req.url === '/tokenize') {
      metadata.push({ route: req.url, request });
      res.end(JSON.stringify({ tokens: Array(promptTokens).fill(1) }));
    } else {
      requests.push(request);
      const result = complete?.(request, requests.length) || { value: valid(), finishReason: 'stop' };
      res.end(JSON.stringify({ choices: [{ finish_reason: result.finishReason,
        message: { content: JSON.stringify(result.value) } }], ...(result.usage && { usage: result.usage }) }));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: 'http://127.0.0.1:' + server.address().port, requests, metadata };
};

test('the explicit prose protocol generates evidence-backed sections with thinking disabled', async t => {
  const server = await localServer(t);
  const job = candidate({ sourceDescription: source.replace('Responsibilities:', '<h2>Responsibilities</h2>') });
  const response = await createRewriteClient(server).generate(buildRewriteInput(job));
  assert.equal(response.format, 'sections');
  assert.equal(validateRewrite(response.value, buildRewriteInput(job), response.finishReason).ok, true);
  assert.equal(REWRITE_MODEL.file, 'LFM2.5-1.2B-Instruct-QAD-Q4_0.gguf');
  assert.equal(server.requests[0].max_tokens, 2048);
  assert.deepEqual(server.requests[0].response_format.json_schema.schema, REWRITE_SCHEMA);
  assert.deepEqual(server.requests[0].chat_template_kwargs, { enable_thinking: false });
  assert.match(JSON.parse(server.requests[0].messages[1].content).employerSource.description, /\nResponsibilities\n/);
  assert.deepEqual(server.metadata.map(row => row.route), ['/apply-template', '/tokenize']);
  assert.equal(server.metadata[1].request.add_special, true);
  assert.equal(server.metadata[1].request.parse_special, true);
});

test('Qwen retries truncation once at 4096 tokens before one source-guarded publication', async t => {
  const server = await localServer(t, { complete: (_request, count) => ({ value: valid(), finishReason: count === 1 ? 'length' : 'stop' }) });
  const job = candidate(), client = createRewriteClient(server);
  let saved, writes = 0;
  const stats = await rewriteCandidates([job], { client, deadline: Date.now() + 10000,
    update: async (filter, values) => { saved = { filter, values }; writes++; return { matchedCount: 1 }; } });
  assert.deepEqual(server.requests.map(row => row.max_tokens), [2048, 4096]);
  assert.equal(stats.published, 1); assert.equal(writes, 1);
  assert.equal(saved.filter.sourceContentHash, job.sourceContentHash);
  assert.equal(saved.values.$inc['descriptionRewrite.attempts'], 1);
  assert.equal(saved.values.$set.sourceDescription, undefined);
  assert.equal(saved.values.$set.category, undefined);
  assert.match(saved.values.$set.description, /## Responsibilities/);
  assert.equal((await client.generate(buildRewriteInput(job))).generationRequests, 0);
  assert.equal(server.requests.length, 2);
});

test('template token counts bound the initial output and retry even without usage', async t => {
  const server = await localServer(t, { promptTokens: REWRITE_MODEL.contextTokens - 64 - 2500,
    complete: () => ({ value: valid(), finishReason: 'length' }) });
  await createRewriteClient(server).generate(buildRewriteInput(candidate()));
  assert.deepEqual(server.requests.map(row => row.max_tokens), [2048, 2500]);
  const smaller = await localServer(t, { promptTokens: REWRITE_MODEL.contextTokens - 64 - 1000,
    complete: () => ({ value: valid(), finishReason: 'length' }) });
  await createRewriteClient(smaller).generate(buildRewriteInput(candidate()));
  assert.deepEqual(smaller.requests.map(row => row.max_tokens), [1000]);
});

test('oversized prompts retain the original without an inference call', async t => {
  const server = await localServer(t, { promptTokens: REWRITE_MODEL.contextTokens });
  let saved, result;
  const stats = await rewriteCandidates([candidate()], { client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; }, onResult: value => { result = value; } });
  assert.equal(stats.skipped, 1); assert.equal(stats.failed, 0);
  assert.equal(saved.$set['descriptionRewrite.reason'], 'model_context_budget');
  assert.equal(saved.$set.description, undefined);
  assert.equal(result.generationRequests, 0); assert.equal(server.requests.length, 0);
});

test('Qwen prose caches bind memory and disk reuse to the complete source', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qwen-source-cache-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const server = await localServer(t, { complete: request => {
    const facts = JSON.parse(request.messages[1].content).employerSource, value = valid();
    if (facts.salary) value.sections.push(section('employment', facts.salary));
    return { value, finishReason: 'stop' };
  } });
  const options = { ...server, planCacheDir: directory }, client = createRewriteClient(options);
  const first = buildRewriteInput(candidate({ salary: 'INR 321000 per year' }));
  const changed = buildRewriteInput(candidate({ salary: 'INR 400000 per year' }));
  await client.generate(first);
  assert.equal((await client.generate(first)).cacheSource, 'memory');
  assert.equal((await createRewriteClient(options).generate(first)).cacheSource, 'disk');
  const next = await client.generate(changed);
  assert.equal(next.cachedModelPlan, undefined);
  assert.match(JSON.stringify(next.value), /400000/); assert.doesNotMatch(JSON.stringify(next.value), /321000/);
  await client.generate(buildRewriteInput(candidate({ salary: 'INR 400000 per year', sourceDescription: source.replace('Responsibilities:', '<h2>Responsibilities</h2>') })));
  assert.equal(server.requests.length, 3);
});

test('unsupported generated skills remain warnings, never publish or enter the cache', async t => {
  const server = await localServer(t, { complete: () => {
    const value = valid(); value.sections[1].items[0].text += ' Kubernetes expertise.';
    return { value, finishReason: 'stop' };
  } });
  const client = createRewriteClient(server); let saved;
  const stats = await rewriteCandidates([candidate()], { client, deadline: Date.now() + 10000,
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; } });
  assert.equal(stats.failed, 1); assert.equal(stats.published, 0);
  assert.equal(saved.$set.description, undefined); assert.equal(rewriteProgress(stats).warnings, 1);
  await client.generate(buildRewriteInput(candidate())); assert.equal(server.requests.length, 2);
});

test('conditional employment evidence cannot drop its probation condition', () => {
  const input = buildRewriteInput(candidate({ sourceDescription: source + ' Employment details: Remote work is available after probation.' }));
  const value = valid(); value.sections.push(section('employment', 'Remote work is available.', 'Remote work is available'));
  assert.equal(validateRewrite(value, input, 'stop').reason, 'condition_changed');
  value.sections.at(-1).items[0] = { text: 'Remote work is available after probation.', evidence: 'Remote work is available after probation.', style: 'bullet' };
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('a mixed mandatory and preferred sentence keeps both scopes', () => {
  const input = buildRewriteInput(candidate({ sourceDescription: source + ' Required skills: Python experience is required, while Java experience is preferred.' }));
  const value = valid(); value.sections.push(section('required_skills', 'Python experience is required'));
  value.sections.find(row => row.key === 'preferred').items.push({ text: 'Java experience is preferred.', evidence: 'Java experience is preferred.', style: 'bullet' });
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
  value.sections.at(-1).key = 'employment';
  assert.equal(validateRewrite(value, input, 'stop').ok, false);
});

test('each distinct responsibility must survive the generated sections', () => {
  const input = buildRewriteInput(candidate({ sourceDescription: source.replace(responsibility, responsibility + ' Diagnose PostgreSQL deadlocks.') }));
  const value = valid(); assert.equal(validateRewrite(value, input, 'stop').reason, 'missing_source_details');
  value.sections[1].items.push({ text: 'Diagnose PostgreSQL deadlocks.', evidence: 'Diagnose PostgreSQL deadlocks.', style: 'bullet' });
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('required headings govern unlabelled clauses in mixed preference sentences', () => {
  const input = buildRewriteInput(candidate({ sourceDescription: source + ' Required skills: Python programming and SQL queries; AWS familiarity is preferred.' }));
  const value = valid(); value.sections.push(section('required_skills', 'Python programming and SQL queries'));
  value.sections.find(row => row.key === 'preferred').items.push({ text: 'AWS familiarity is preferred.', evidence: 'AWS familiarity is preferred.', style: 'bullet' });
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('mandatory duties stay in responsibilities without inventing eligibility', () => {
  const duty = 'Maintain audit logs as required by customers.';
  const input = buildRewriteInput(candidate({ sourceDescription: source.replace(required, 'Python programming experience.').replace(responsibility, duty) }));
  const value = valid(); value.sections[1] = section('responsibilities', duty);
  value.sections[2] = section('required_qualifications', 'Python programming experience.');
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('matching words cannot reverse who mentors whom', () => {
  const duty = 'You will mentor junior developers and learn from senior engineers.';
  const input = buildRewriteInput(candidate({ sourceDescription: source.replace(responsibility, duty) })), value = valid();
  value.sections[1] = section('responsibilities', 'You will mentor senior engineers and learn from junior developers.', duty);
  assert.equal(validateRewrite(value, input, 'stop').reason, 'relationship_changed');
  value.sections[1].items[0].text = duty;
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('employment bonuses are compensation rather than preferred qualifications', () => {
  const bonus = 'Annual bonus paid in December.';
  const input = buildRewriteInput(candidate({ sourceDescription: source + ' Employment details: ' + bonus })), value = valid();
  value.sections.push(section('employment', bonus));
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('metadata qualification evidence cannot bypass relationship preservation', () => {
  const qualification = 'Experience mentoring junior developers and learning from senior engineers.';
  const input = buildRewriteInput(candidate({ minimumQualification: qualification })), value = valid();
  value.sections[2].items.push({ text: 'Experience mentoring senior engineers and learning from junior developers.', evidence: qualification, style: 'bullet' });
  assert.equal(validateRewrite(value, input, 'stop').reason, 'relationship_changed');
  value.sections[2].items.at(-1).text = qualification;
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('action verbs cannot be reassigned between responsibilities', () => {
  const duty = 'Design cloud APIs and maintain payment services.';
  const input = buildRewriteInput(candidate({ sourceDescription: source.replace(responsibility, duty) })), value = valid();
  value.sections[1] = section('responsibilities', 'Maintain cloud APIs and design payment services.', duty);
  assert.equal(validateRewrite(value, input, 'stop').reason, 'relationship_changed');
  value.sections[1].items[0].text = duty;
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
});

test('dry-run audit revalidates Qwen sections and checks rendered output', () => {
  const job = candidate(), rawPlan = valid(), checked = validateRewrite(rawPlan, buildRewriteInput(job), 'stop');
  const row = { outputMethod: 'validated_source_grounded_sections', job, originalDescription: job.sourceDescription,
    rawPlan, finishReason: 'stop', description: checked.description };
  assert.equal(auditDescriptionCase(row).ok, true);
  assert.deepEqual(auditDescriptionCase({ ...row, description: checked.description + ' Unrelated text.' }).failures, ['rendered_description_changed']);
  assert.equal(auditDescriptionCase({ ...row, rawPlan: { sections: [] } }).ok, false);
});

for (const [statement, changed] of [["The role cannot sponsor visas.", 'The role can sponsor visas.'],
  ["Applicants don't need security clearance.", 'Applicants need security clearance.'],
  ["The role isn't remote.", 'The role is remote.']]) {
  test('negated employer statement retains its polarity: ' + statement, () => {
    const input = buildRewriteInput(candidate({ sourceDescription: source + ' Employment details: ' + statement }));
    const value = valid(); value.sections.push(section('employment', changed, statement));
    assert.equal(validateRewrite(value, input, 'stop').ok, false);
    value.sections.at(-1).items[0].text = statement;
    assert.equal(validateRewrite(value, input, 'stop').ok, true);
  });
}

test('short employer metadata supports labels but cannot support new claims', () => {
  const input = buildRewriteInput(candidate({ location: 'Pune' })), value = valid();
  value.sections.push(section('employment', 'Location: Pune', 'Pune'));
  assert.equal(validateRewrite(value, input, 'stop').ok, true);
  value.sections.at(-1).items[0].text = 'Remote location: Pune';
  assert.equal(validateRewrite(value, input, 'stop').ok, false);
});
