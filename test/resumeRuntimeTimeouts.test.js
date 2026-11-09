import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';

test('generation can continue past eight minutes while staying inside the caller deadline', async t => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const deadline = Date.now() + 20 * 60000;
  const fetchImpl = async url => ({ ok: true, json: async () => url.endsWith('/apply-template')
    ? { prompt: 'synthetic prompt' } : url.endsWith('/tokenize') ? { tokens: [1, 2, 3] }
      : { choices: [{ finish_reason: 'stop', message: { content: 'complete synthetic document' } }] } });
  assert.equal(await generateResumeText('synthetic source', { fetchImpl, deadline }), 'complete synthetic document');
  assert.equal(timeouts.length, 3);
  assert.ok(timeouts.every(milliseconds => milliseconds > 19 * 60000 && milliseconds <= 20 * 60000),
    'all model requests must use the caller deadline instead of an eight-minute cutoff');
});

async function startModelServer(t, completionDelay) {
  const server = createServer((request, response) => {
    request.resume();
    const send = value => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    if (request.url === '/apply-template') return send({ prompt: 'synthetic prompt' });
    if (request.url === '/tokenize') return send({ tokens: [1, 2, 3] });
    const timer = setTimeout(() => send({
      choices: [{ finish_reason: 'stop', message: { content: 'complete synthetic document' } }],
      usage: { completion_tokens: 3 },
    }), completionDelay);
    response.once('close', () => clearTimeout(timer));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  return (url, options) => fetch(`${origin}${new URL(url).pathname}`, options);
}

test('slow model responses outlive the default transport timeout without changing the global dispatcher', { timeout: 15000 }, async t => {
  const previousDispatcher = getGlobalDispatcher();
  const shortDispatcher = new Agent({ headersTimeout: 200, bodyTimeout: 200 });
  setGlobalDispatcher(shortDispatcher);
  t.after(async () => {
    setGlobalDispatcher(previousDispatcher);
    await shortDispatcher.destroy();
  });
  const fetchImpl = await startModelServer(t, 2200);
  const result = await generateResumeText('synthetic source', {
    fetchImpl, deadline: Date.now() + 10000,
  });
  assert.equal(result, 'complete synthetic document');
  assert.equal(getGlobalDispatcher(), shortDispatcher);
});

test('model HTTP requests still stop at the overall deadline', { timeout: 5000 }, async t => {
  const fetchImpl = await startModelServer(t, 10000);
  await assert.rejects(generateResumeText('synthetic source', {
    fetchImpl, deadline: Date.now() + 250,
  }), { code: 'model_timeout' });
});

for (const [phase, code] of [
  ['fetch', 'UND_ERR_HEADERS_TIMEOUT'],
  ['fetch', 'UND_ERR_CONNECT_TIMEOUT'],
  ['fetch', 'ETIMEDOUT'],
  ['body', 'UND_ERR_BODY_TIMEOUT'],
]) {
  test(`${code} during ${phase} is reported as a model timeout without private error text`, async () => {
    const upstreamError = new TypeError('private candidate response', {
      cause: Object.assign(new Error('private model diagnostic'), { code }),
    });
    const fetchImpl = async url => {
      if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: 'synthetic prompt' }) };
      if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: [1, 2, 3] }) };
      if (phase === 'fetch') throw upstreamError;
      return { ok: true, json: async () => { throw upstreamError; } };
    };
    await assert.rejects(generateResumeText('synthetic source', { fetchImpl }), error => {
      assert.equal(error.code, 'model_timeout');
      assert.doesNotMatch(error.message, /private/);
      assert.doesNotMatch(JSON.stringify(error), /private/);
      return true;
    });
  });
}
