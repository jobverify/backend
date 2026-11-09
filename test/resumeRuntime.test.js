import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResumeText, RESUME_MODEL } from '../resume-tailoring/resumeRuntime.js';
import { compilerArguments, compilerFailure } from '../resume-tailoring/latexCompiler.js';

test('resume model is pinned separately and counts the complete rendered prompt before inference', async () => {
  assert.match(RESUME_MODEL.modelId, /Qwen3-4B-Instruct-2507/);
  assert.match(RESUME_MODEL.revision, /^[a-f0-9]{40}$/);
  assert.match(RESUME_MODEL.sha256, /^[a-f0-9]{64}$/);
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, body });
    return { ok: true, json: async () => url.endsWith('/apply-template') ? { prompt: 'entire rendered prompt' }
      : url.endsWith('/tokenize') ? { tokens: Array(RESUME_MODEL.contextTokens).fill(1) }
        : assert.fail('oversized input must not reach inference') };
  };
  await assert.rejects(generateResumeText('full resume and job', { fetchImpl }), { statusCode: 422 });
  assert.equal(calls[0].body.messages[0].content, 'full resume and job');
  assert.equal(calls[1].body.content, 'entire rendered prompt');
});

test('incomplete model output is rejected and verifier uses constrained JSON', async () => {
  let completion;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: 'full' }) };
    if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: [1, 2] }) };
    completion = body;
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] }) };
  };
  await assert.rejects(generateResumeText('compare', { fetchImpl, comparison: true }), /incomplete/i);
  assert.equal(completion.response_format.type, 'json_schema');
  assert.equal(Object.keys(completion.response_format.json_schema.schema.properties)[0], 'evidence');
  assert.ok(completion.response_format.json_schema.schema.required.includes('evidence'));
});

test('LaTeX inference constrains packages and document structure without constraining the factual audit as LaTeX', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: 'full' }) };
    if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: [1, 2] }) };
    requests.push(body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'synthetic result' } }] }) };
  };
  await generateResumeText('synthetic resume', { fetchImpl });
  await generateResumeText('synthetic audit', { fetchImpl, comparison: true });
  assert.equal(typeof requests[0].grammar, 'string', 'generation must enforce its compiler-supported format during decoding');
  assert.match(requests[0].grammar, /documentclass/);
  assert.match(requests[0].grammar, /hyperref/);
  assert.doesNotMatch(requests[0].grammar, /inputenc|fontspec|fontawesome/);
  assert.equal(requests[1].grammar, undefined);
  assert.equal(requests[1].response_format.type, 'json_schema');
});

test('LaTeX decoding limits hyperlinks to the supplied safe source destinations', async () => {
  let completion;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: 'full' }) };
    if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: [1, 2] }) };
    completion = body;
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'synthetic result' } }] }) };
  };
  await generateResumeText('synthetic resume', { fetchImpl, allowedLinks: ['mailto:alex@example.test', 'tel:+12025550123',
    'https://example.test/alex_certificate?view=1&lang=en', 'https://example.test/A%20B', 'javascript:alert(1)', 'https://example.test/%0ABad'] });
  const targets = completion.grammar.split('\n').find(line => line.startsWith('link-target ::='));
  assert.ok(targets, 'the decoder needs a separate constrained link destination rule');
  const values = targets.slice('link-target ::='.length).trim().split(' | ').map(value => JSON.parse(value));
  assert.deepEqual(values, ['mailto:alex@example.test', 'tel:+12025550123', String.raw`https://example.test/alex\_certificate?view=1\&lang=en`, String.raw`https://example.test/A\%20B`]);
  assert.ok(!completion.grammar.split('\n').find(line => line.startsWith('command ::=')).includes('"href"'), 'generic commands must not bypass constrained links');
});

test('compiler isolation has no host mounts, network, secrets or shell execution', () => {
  const args = compilerArguments({ name: 'resume-test', image: 'sha256:' + 'a'.repeat(64) });
  assert.ok(args.includes('none'));
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--cap-drop=ALL'));
  assert.ok(args.includes('--security-opt=no-new-privileges'));
  assert.ok(args.includes('--memory=512m'));
  assert.ok(args.includes('--pids-limit=64'));
  assert.ok(args.includes('--untrusted'));
  assert.ok(args.includes('--only-cached'));
  assert.equal(args.some(arg => /(?:--volume|--mount|MONGO|GITHUB|--shell-escape)/.test(arg)), false);
});

test('compiler failures retain only fixed reason codes and discard private diagnostics', () => {
  const error = compilerFailure({ stderr: 'private source alex@example.test\nRESUME_COMPILER_DEPENDENCY_MISSING\n', code: 1 });
  assert.equal(error.code, 'compiler_dependency_missing');
  assert.doesNotMatch(error.message, /private|alex@/);
  assert.equal(compilerFailure({ code: 137 }).code, 'compiler_resource_limit');
  assert.equal(compilerFailure({ stderr: 'untrusted content with missing-file speculation', code: 1 }).code, 'compiler_failed');
});

test('upstream model exceptions become useful safe failures without exposing response data', async () => {
  await assert.rejects(generateResumeText('private candidate input', {
    fetchImpl: async () => { throw Error('private model text and database configuration'); },
  }), error => error.code === 'model_unavailable' && !/private|database/.test(error.message));
  await assert.rejects(generateResumeText('private candidate input', {
    fetchImpl: async () => ({ ok: true, json: async () => { throw Error('private response data'); } }),
  }), error => error.code === 'model_protocol_invalid' && !/private/.test(error.message));
});
