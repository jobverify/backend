import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRewriteClient as createProductionRewriteClient, rewriteCandidates } from '../rewriting/runner.js';
import { REWRITE_MODEL, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
const createRewriteClient = options => createProductionRewriteClient({ format: 'fact-plan', ...options });

const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
const candidate = () => {
  const job = { _id: 'truncated-description', title: 'Software Engineer', company: 'Example', status: 'active',
    sourceDescription: source, descriptionRewrite: { status: 'pending', attempts: 0 } };
  job.sourceContentHash = job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
  return job;
};
const localServer = async (t, handler) => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let body = ''; for await (const part of request) body += part;
    requests.push(JSON.parse(body));
    await handler(response, requests.length, requests.at(-1));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: 'http://127.0.0.1:' + server.address().port, requests };
};
const completion = (response, reason, tokens, promptTokens = 2602) => {
  response.setHeader('Content-Type', 'text/event-stream');
  const content = reason === 'stop' ? JSON.stringify({ categories: [], overviewFactId: 0 }) : '{"categories":[';
  response.end('data: ' + JSON.stringify({ choices: [{ delta: { content }, finish_reason: reason }],
    usage: { completion_tokens: tokens, prompt_tokens: promptTokens, total_tokens: promptTokens + tokens } }) + '\n\ndata: [DONE]\n\n');
};

test('a token-limited completion retries once with more room before one guarded publication', async t => {
  let writes = 0, saved, result;
  const server = await localServer(t, (response, count, request) => {
    assert.equal(writes, 0, 'Partial output must never be saved');
    completion(response, count === 1 ? 'length' : 'stop', count === 1 ? request.max_tokens : 12);
  });
  const job = candidate(), client = createRewriteClient(server);
  const stats = await rewriteCandidates([job], { client, deadline: Date.now() + 10000,
    update: async (_filter, values) => { writes++; saved = values; return { matchedCount: 1 }; },
    onResult: value => { result = value; },
  });
  assert.deepEqual(server.requests.map(request => request.max_tokens), [768, 1536]);
  assert.equal(stats.published, 1); assert.equal(stats.failed, 0); assert.equal(writes, 1);
  assert.equal(saved.$inc['descriptionRewrite.attempts'], 1);
  assert.match(saved.$set.description, /At least 2 years/);
  assert.equal(result.generationRequests, 2);
  const cached = await client.generate(buildRewriteInput(job));
  assert.equal(cached.cachedModelPlan, true); assert.equal(cached.generationRequests, 0);
  assert.equal(server.requests.length, 2);
});

test('repeated truncation stays bounded and retains the original description', async t => {
  const server = await localServer(t, (response, _count, request) => completion(response, 'length', request.max_tokens));
  let saved;
  const stats = await rewriteCandidates([candidate()], { client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; },
  });
  assert.equal(server.requests.length, 2); assert.equal(stats.failed, 1); assert.equal(stats.published, 0);
  assert.equal(saved.$set['descriptionRewrite.reason'], 'truncated'); assert.equal(saved.$set.description, undefined);
  assert.equal(saved.$inc['descriptionRewrite.attempts'], 1);
});

test('a retry never requests more tokens than the remaining per-slot context', async t => {
  const promptTokens = REWRITE_MODEL.contextTokens - 32 - 1000;
  const server = await localServer(t, (response, _count, request) => completion(response, 'length', request.max_tokens, promptTokens));
  const output = await createRewriteClient(server).generate(buildRewriteInput(candidate()));
  assert.deepEqual(server.requests.map(request => request.max_tokens), [768, 1000]);
  assert.equal(output.finishReason, 'length');
});

test('there is no retry when the context has no extra output space', async t => {
  const server = await localServer(t, (response, _count, request) => completion(response, 'length', request.max_tokens,
    REWRITE_MODEL.contextTokens - 32 - request.max_tokens));
  const output = await createRewriteClient(server).generate(buildRewriteInput(candidate()));
  assert.equal(server.requests.length, 1); assert.equal(output.finishReason, 'length');
});

test('a hung retry is bounded by the request timeout', async t => {
  const server = await localServer(t, (response, count, request) => {
    if (count === 1) completion(response, 'length', request.max_tokens);
    // The second request deliberately never completes.
  });
  await assert.rejects(createRewriteClient({ ...server, requestMs: 500 }).generate(buildRewriteInput(candidate())),
    error => error.name === 'TimeoutError' && error.generationRequests === 2);
  assert.equal(server.requests.length, 2);
});

test('cancellation after a truncated response leaves the queue entry untouched', async t => {
  const controller = new AbortController();
  const server = await localServer(t, (response, _count, request) => {
    completion(response, 'length', request.max_tokens);
    controller.abort();
  });
  let writes = 0;
  const stats = await rewriteCandidates([candidate()], { client: createRewriteClient(server), signal: controller.signal,
    deadline: Date.now() + 10000, update: async () => { writes++; return { matchedCount: 1 }; },
  });
  assert.equal(server.requests.length, 1); assert.equal(writes, 0); assert.equal(stats.interrupted, true);
});

test('an HTTP failure during a retry still reports both model requests', async t => {
  const server = await localServer(t, (response, count, request) => {
    if (count === 1) completion(response, 'length', request.max_tokens);
    else { response.statusCode = 500; response.end(); }
  });
  let result;
  const stats = await rewriteCandidates([candidate()], { client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async () => ({ matchedCount: 1 }), onResult: value => { result = value; },
  });
  assert.equal(server.requests.length, 2); assert.equal(stats.failed, 1); assert.equal(result.generationRequests, 2);
});
