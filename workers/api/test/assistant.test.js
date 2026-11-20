import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkersAssistantModel } from '../src/assistantModel.js';

test('Workers assistant adapter uses only its injected binding, fixed model and bounded output', async () => {
  const calls = [];
  const output = { tool_calls: [{ name: 'lookup_help', arguments: { topic: 'contact' } }] };
  const model = createWorkersAssistantModel({ run: async (...args) => { calls.push(args); return output; } });
  const messages = [{ role: 'user', content: 'How do I contact support?' }];
  const tools = [{ name: 'lookup_help' }];
  assert.deepEqual(await model({ messages, tools, maxTokens: 512 }), output);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  assert.deepEqual(calls[0][1], { messages, tools, max_tokens: 512, temperature: 0, stream: false });
});

test('missing binding disables the optional adapter and an aborted turn makes no inference', async () => {
  assert.equal(createWorkersAssistantModel(), undefined);
  let calls = 0;
  const model = createWorkersAssistantModel({ run: async () => { calls++; } });
  await assert.rejects(model({ signal: AbortSignal.abort() }), error => error.name === 'AbortError');
  assert.equal(calls, 0);
});

test('Workers quota failure is returned once without another provider or a retry', async () => {
  let calls = 0;
  const model = createWorkersAssistantModel({ run: async () => {
    calls++; throw Object.assign(new Error('3036: quota exceeded'), { code: 3036 });
  } });
  await assert.rejects(model({ messages: [], tools: [], maxTokens: 100 }), error => error.code === 3036);
  assert.equal(calls, 1);
});
