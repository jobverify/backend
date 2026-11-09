import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient, rewriteCandidates } from '../rewriting/runner.js';
import { validateProseRewrite } from '../rewriting/prose.js';

const input = buildRewriteInput({ title: 'Engineer', company: 'Example', sourceDescription: 'Build reliable Python services.' });
const localServer = async (t, intercept, complete = source => source.replace('Build', 'Develop')) => {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw), call = { route: req.url, body };
    calls.push(call);
    if (intercept?.(req, res, call, calls)) return;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: JSON.stringify(body.messages) }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify({ text: complete(body.messages.at(-1).content, body) }),
    } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, calls };
};

for (const route of ['/apply-template', '/tokenize']) test(`a dropped ${route} connection recovers without repeating inference`, async t => {
  let dropped = false;
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== route || dropped) return false;
    dropped = true;
    req.socket.destroy();
    return true;
  });
  const response = await createRewriteClient(server).generate(input);
  const result = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(result.ok, true);
  assert.equal(result.description, 'Develop reliable Python services.');
  assert.equal(response.generationRequests, 1);
  assert.equal(response.transportRetries, 1);
  assert.equal(server.calls.filter(call => call.route === '/v1/chat/completions').length, 1);
});

test('a connection lost while reading tokenizer JSON is retried', async t => {
  let dropped = false;
  const server = await localServer(t, (_req, res, call) => {
    if (call.route !== '/tokenize' || dropped) return false;
    dropped = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"tokens":[');
    setTimeout(() => res.destroy(), 10);
    return true;
  });
  const response = await createRewriteClient(server).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(response.transportRetries, 1);
});

test('persistent tokenizer connection loss stops after two retries', async t => {
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/tokenize') return false;
    req.socket.destroy();
    return true;
  });
  await assert.rejects(createRewriteClient(server).generate(input), error => {
    assert.equal(error.name, 'RewriteGenerationError');
    assert.equal(error.errorDiagnostic.phase, 'tokenize_prompt');
    assert.equal(error.generationRequests, 0);
    assert.equal(error.transportRetries, 2);
    return true;
  });
  assert.equal(server.calls.filter(call => call.route === '/tokenize').length, 3);
  assert.equal(server.calls.filter(call => call.route === '/v1/chat/completions').length, 0);
});

test('a lost inference connection is not replayed automatically', async t => {
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/v1/chat/completions') return false;
    req.socket.destroy();
    return true;
  });
  await assert.rejects(createRewriteClient(server).generate(input), error => {
    assert.equal(error.name, 'RewriteGenerationError');
    assert.equal(error.generationRequests, 1);
    return true;
  });
  assert.equal(server.calls.filter(call => call.route === '/v1/chat/completions').length, 1);
});

test('an HTTP error from the tokenizer is not treated as a transient socket failure', async t => {
  const server = await localServer(t, (_req, res, call) => {
    if (call.route !== '/tokenize') return false;
    res.writeHead(500);
    res.end('{}');
    return true;
  });
  await assert.rejects(createRewriteClient(server).generate(input), /Local generator HTTP 500/);
  assert.equal(server.calls.filter(call => call.route === '/tokenize').length, 1);
});

test('cancelling a preflight retry cannot continue to inference', async t => {
  const controller = new AbortController(), cancelled = new Error('Cancelled during preflight');
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/tokenize') return false;
    req.socket.destroy();
    setTimeout(() => controller.abort(cancelled), 15);
    return true;
  });
  await assert.rejects(createRewriteClient(server).generate(input, { signal: controller.signal }), error => error === cancelled);
  assert.equal(server.calls.filter(call => call.route === '/tokenize').length, 1);
  assert.equal(server.calls.filter(call => call.route === '/v1/chat/completions').length, 0);
});

test('a corrective generation reuses the exact source token count while counting its new prompt', async t => {
  let generations = 0;
  const server = await localServer(t, null, source => ++generations === 1 ? 'Invented Kotlin duties.' : source.replace('Build', 'Develop'));
  const response = await createRewriteClient(server).generate(input);
  assert.equal(validateProseRewrite(response.value, input, 'stop').ok, true);
  assert.equal(response.generationRequests, 2);
  const counts = server.calls.filter(call => call.route === '/tokenize');
  assert.equal(counts.filter(call => call.body.add_special === true).length, 2);
  assert.equal(counts.filter(call => call.body.add_special === false).length, 1);
  assert.deepEqual(counts.find(call => call.body.add_special === false).body, {
    content: '{"text":"Build reliable Python services."}', add_special: false, parse_special: false,
  });
});

for (const persistent of [false, true]) test(`job results retain preflight retry counts when recovery ${persistent ? 'fails' : 'succeeds'}`, async t => {
  let dropped = false;
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/tokenize' || (dropped && !persistent)) return false;
    dropped = true;
    req.socket.destroy();
    return true;
  });
  let record;
  const stats = await rewriteCandidates([{ _id: 'transport', status: 'active', title: 'Engineer', company: 'Example',
    sourceDescription: input.sourceDescription, sourceContentHash: input.inputHash,
    descriptionRewrite: { status: 'pending', inputHash: input.inputHash } }], {
    client: createRewriteClient(server), deadline: Date.now() + 10000,
    update: async () => ({ matchedCount: 1 }), onResult: value => { record = value; },
  });
  assert.equal(record.transportRetries, persistent ? 2 : 1);
  assert.equal(record.published, !persistent);
  assert.equal(stats.published, persistent ? 0 : 1);
  assert.equal(stats.failed, persistent ? 1 : 0);
});

test('duplicate callers charge a shared preflight failure once', async t => {
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/tokenize') return false;
    req.socket.destroy();
    return true;
  });
  const client = createRewriteClient(server);
  const results = await Promise.allSettled([client.generate(input), client.generate(input)]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.deepEqual(results.map(result => result.reason.transportRetries).sort(), [0, 2]);
  assert.equal(server.calls.filter(call => call.route === '/tokenize').length, 3);
});

test('a deadline after preflight retries retains their cost without starting inference', async t => {
  let tokenizations = 0;
  const server = await localServer(t, (req, _res, call) => {
    if (call.route !== '/tokenize') return false;
    if (++tokenizations <= 2) req.socket.destroy();
    return true;
  });
  await assert.rejects(createRewriteClient({ ...server, requestMs: 1000 }).generate(input), error => {
    assert.equal(error.name, 'TimeoutError');
    assert.equal(error.transportRetries, 2);
    assert.equal(error.generationRequests, 0);
    return true;
  });
  assert.equal(tokenizations, 3);
  assert.equal(server.calls.filter(call => call.route === '/v1/chat/completions').length, 0);
});
