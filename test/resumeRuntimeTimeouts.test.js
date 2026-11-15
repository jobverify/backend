import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';

test('generation can continue past eight minutes while staying inside the caller deadline', async t => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', milliseconds => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const deadline = Date.now() + 20 * 60000;
  const fetchImpl = async url => ({ ok: true, json: async () => url.endsWith('/apply-template')
    ? { prompt: 'synthetic prompt' } : url.endsWith('/tokenize') ? { tokens: [1, 2, 3] }
      : { content: 'complete synthetic body', stop_type: 'eos' } });
  assert.equal(await generateResumeText('synthetic source', { fetchImpl, deadline }), RESUME_LATEX_PREAMBLE + 'complete synthetic body');
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
      content: 'complete synthetic body', stop_type: 'eos', timings: { predicted_n: 3 },
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
  assert.equal(result, RESUME_LATEX_PREAMBLE + 'complete synthetic body');
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
test('long inference reports numeric progress without exposing slot prompts and stops polling on completion', async t => {
  let tick, intervalCleared = false, slotSignal;
  t.mock.method(globalThis, 'setInterval', callback => { tick = callback; return { unref() {} }; });
  t.mock.method(globalThis, 'clearInterval', () => { intervalCleared = true; });
  const started = Promise.withResolvers();
  const completed = Promise.withResolvers();
  const diagnostics = [];
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: 'full' }) };
    if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: [1, 2, 3] }) };
    if (url.endsWith('/slots')) {
      slotSignal = options.signal;
      return { ok: true, json: async () => [{ is_processing: true, n_prompt_tokens_processed: 2,
        next_token: [{ n_decoded: 17 }], params: { prompt: 'private candidate and source data' } }] };
    }
    started.resolve();
    await completed.promise;
    return { ok: true, json: async () => ({ content: '\\end{document}', stop_type: 'eos', timings: { predicted_n: 19 } }) };
  };
  const pending = generateResumeText('private source', { fetchImpl, onDiagnostic: event => diagnostics.push(event) });
  try {
    await started.promise;
    assert.equal(typeof tick, 'function', 'long generations need a progress monitor before waiting on completion');
    await tick();
    const progress = diagnostics.find(event => event.code === 'progress');
    assert.equal(progress.stage, 'generating');
    assert.equal(progress.inputTokens, 3);
    assert.equal(progress.processedTokens, 2);
    assert.equal(progress.outputTokens, 17);
    assert.ok(Number.isFinite(progress.seconds));
    assert.doesNotMatch(JSON.stringify(diagnostics), /private|candidate|params|prompt/);
  } finally {
    completed.resolve();
    await pending;
  }
  assert.equal(intervalCleared, true);
  assert.equal(slotSignal.aborted, true, 'completion must also abort any in-flight progress request');
});
