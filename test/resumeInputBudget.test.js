import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';
import { buildLatexTailoringPrompt, buildLatexRepairPrompt } from '../src/services/resumeLatexContent.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';

const source = { pageCount: 2, links: [], text: 'Alex Example\nalex@example.test\nEXPERIENCE\nCedar Systems | Jan 2022 - Present\nSoftware Engineer\nBuilt Python services, reducing latency by 25%.\nEDUCATION\nValley University | 2016 - 2020\nBSc Computer Science' };
const job = { title: 'Software Engineer', company: 'Example', description: 'Build reliable Python services. '.repeat(200) + 'Final requirement: automated testing.' };
const baseBody = '\\section{EXPERIENCE}\nSupported candidate content.\n\\end{document}';

function modelFixture(inputTokens, response = { content: baseBody, stop_type: 'eos' }) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const endpoint = new URL(url).pathname;
    const body = JSON.parse(options.body);
    calls.push({ endpoint, body });
    let payload;
    if (endpoint === '/apply-template') payload = { prompt: '<user>' + body.messages[0].content + '</user><assistant>' };
    else if (endpoint === '/tokenize') payload = { tokens: Array(inputTokens).fill(1) };
    else if (endpoint === '/completion' || endpoint === '/v1/chat/completions') payload = response;
    else assert.fail('Unexpected model endpoint: ' + endpoint);
    return { ok: true, json: async () => payload };
  };
  return { calls, fetchImpl };
}

function tailoringData(prompt) {
  return JSON.parse(prompt.split('\n').find(line => line.startsWith('{"originalResume":')));
}

test('tailoring reuses the trusted preamble while retaining the entire prepared body, source and job', () => {
  const original = structuredClone(source);
  const body = baseBody.replace('Supported candidate content.', 'Supported candidate content. ' + RESUME_LATEX_PREAMBLE);
  const prompt = buildLatexTailoringPrompt({ source, baseLatex: RESUME_LATEX_PREAMBLE + body, jobSnapshot: job });
  const data = tailoringData(prompt);
  assert.equal(data.preparedBaseLatex, body, 'only the leading immutable template may be omitted');
  assert.equal(data.preparedBasePreambleOmitted, true);
  assert.equal(data.originalResume.text, source.text);
  assert.equal(data.job.description, job.description);
  assert.deepEqual(source, original);
  assert.match(prompt, /preparedBasePreambleOmitted.*preamble/i);
  const repair = buildLatexRepairPrompt({ originalPrompt: prompt, latex: RESUME_LATEX_PREAMBLE + baseBody, issues: ['Repair the body'] });
  assert.equal(tailoringData(repair).preparedBaseLatex, body, 'the repair must retain the same complete base content');
});

test('tailoring retains a legacy or modified preamble with its content definitions', () => {
  const legacy = '\\documentclass{article}\n\\newcommand{\\candidate}{Alex Example}\n\\begin{document}\n\\candidate\n\\end{document}';
  for (const baseLatex of [legacy, RESUME_LATEX_PREAMBLE.replace('11pt', '12pt') + baseBody, '']) {
    const data = tailoringData(buildLatexTailoringPrompt({ source, baseLatex, jobSnapshot: job }));
    assert.equal(data.preparedBaseLatex, baseLatex);
    assert.equal(data.preparedBasePreambleOmitted, false);
  }
});

test('a complete tailoring prompt can share context with a smaller output allowance', async () => {
  const { calls, fetchImpl } = modelFixture(11000);
  const prompt = buildLatexTailoringPrompt({ source, baseLatex: RESUME_LATEX_PREAMBLE + baseBody, jobSnapshot: job });
  const result = await generateResumeText(prompt, { fetchImpl });
  assert.equal(result, RESUME_LATEX_PREAMBLE + baseBody);
  const tokenization = calls.find(call => call.endpoint === '/tokenize').body;
  const completion = calls.find(call => call.endpoint === '/completion').body;
  assert.equal(completion.n_predict, 5352, '16384 context - 11000 input - 32 safety tokens');
  assert.equal(completion.prompt, tokenization.content, 'inference must receive the entire counted prompt');
  const data = tailoringData(calls[0].body.messages[0].content);
  assert.equal(data.originalResume.text, source.text);
  assert.equal(data.job.description, job.description);
  assert.equal(data.preparedBaseLatex, baseBody);
});

test('generation keeps its full output allowance when it fits and accepts the minimum at the boundary', async () => {
  for (const [inputTokens, expectedOutput] of [[10000, 6144], [10208, 6144], [10209, 6143], [14304, 2048]]) {
    const { calls, fetchImpl } = modelFixture(inputTokens);
    assert.equal(await generateResumeText('complete source and job', { fetchImpl }), RESUME_LATEX_PREAMBLE + baseBody);
    assert.equal(calls.at(-1).body.n_predict, expectedOutput, `${inputTokens} input tokens`);
  }
});

test('generation rejects insufficient output space before inference without truncating the input', async () => {
  for (const inputTokens of [14305, 16384]) {
    const { calls, fetchImpl } = modelFixture(inputTokens);
    await assert.rejects(generateResumeText('complete source and job', { fetchImpl }), { code: 'input_too_large', statusCode: 422 });
    assert.deepEqual(calls.map(call => call.endpoint), ['/apply-template', '/tokenize']);
    assert.equal(calls[0].body.messages[0].content, 'complete source and job');
  }
});

test('independent audits and pagination retain their complete JSON output budgets', async () => {
  const response = { choices: [{ finish_reason: 'stop', message: { content: '{}' } }] };
  for (const [options, inputTokens, expectedOutput] of [[{ comparison: true }, 14816, 1536], [{ paginationRepair: true }, 16224, 128]]) {
    const { calls, fetchImpl } = modelFixture(inputTokens, response);
    assert.equal(await generateResumeText('complete evidence', { fetchImpl, ...options }), '{}');
    assert.equal(calls.at(-1).body.max_tokens, expectedOutput);
    const overflow = modelFixture(inputTokens + 1, response);
    await assert.rejects(generateResumeText('complete evidence', { fetchImpl: overflow.fetchImpl, ...options }), { code: 'input_too_large' });
    assert.equal(overflow.calls.at(-1).endpoint, '/tokenize');
  }
});

test('a reduced output allowance never publishes incomplete or context-truncated output', async () => {
  for (const response of [{ content: 'partial', stop_type: 'limit' }, { content: baseBody, stop_type: 'eos', truncated: true }]) {
    const { fetchImpl } = modelFixture(11000, response);
    await assert.rejects(generateResumeText('complete source and job', { fetchImpl }), { code: 'model_output_incomplete' });
  }
});
