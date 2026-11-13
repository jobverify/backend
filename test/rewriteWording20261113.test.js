import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { createRewriteClient } from '../rewriting/runner.js';
import { validateProseRewrite } from '../rewriting/prose.js';

test('a factual correction can retain clearer wording instead of forcing a source copy', async t => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (req.url === '/apply-template') return res.end(JSON.stringify({ prompt: 'source' }));
    if (req.url === '/tokenize') return res.end(JSON.stringify({ tokens: [1, 2, 3] }));
    requests.push(request);
    const text = requests.length === 1 ? 'You can build reliable Python services.' : 'You will build reliable Python services.';
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const input = buildRewriteInput({ title: 'Engineer', sourceDescription: 'You will be responsible for building reliable Python services.' });
  const response = await createRewriteClient({ endpoint: `http://127.0.0.1:${server.address().port}` }).generate(input, { allowSourceFallback: false });
  const checked = validateProseRewrite(response.value, input, response.finishReason);
  assert.equal(checked.ok, true);
  assert.equal(checked.quality.modelWordingEditedBlocks, 1);
  assert.equal(response.correctionsAccepted, 1);
  assert.doesNotMatch(requests[1].messages[0].content, /preserving every original word|make only formatting changes/i);
});

test('direct client generation rejects ATS data without starting inference', async () => {
  const sourceDescription = '{"onboardingConfig":{"disablePrePopulation":false},"viewMode":{"fieldLabel":"Duration"}}';
  const input = buildRewriteInput({ title: 'Engineer', sourceDescription });
  const response = await createRewriteClient({ endpoint: 'http://127.0.0.1:9' }).generate(input);
  assert.equal(response.generationRequests, 0);
  assert.equal(response.validationFailure.reason, 'non_job_source_content');
});
