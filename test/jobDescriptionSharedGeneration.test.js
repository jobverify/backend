import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationPool } from '../rewriting/sharedGeneration.js';

test('external cancellation reports the cost of shared work once without mutating the shared reason', async () => {
  const controller = new AbortController();
  const reason = Object.freeze(Object.assign(new Error('budget exhausted'), { name: 'AbortError' }));
  let start;
  const ready = new Promise(resolve => { start = resolve; });
  const costs = [];
  const generate = createGenerationPool({ requestMs: 1000, keyFor: () => 'same', bindResult: value => value,
    generate: async (_input, { signal, onProgress }) => {
      onProgress({ generationRequests: 3, correctionRequests: 1, correctionsRejected: 1 }); start();
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      signal.throwIfAborted();
    } });
  const work = [0, 1].map(() => generate({}, { signal: controller.signal, onInterrupted: cost => costs.push(cost) }));
  const rejected = work.map(promise => assert.rejects(promise, error => error === reason));
  await ready;
  controller.abort(reason);
  await Promise.all(rejected);
  assert.equal(costs.length, 2);
  assert.equal(costs.reduce((sum, cost) => sum + cost.generationRequests, 0), 3);
  assert.equal(costs.reduce((sum, cost) => sum + cost.correctionRequests, 0), 1);
  assert.equal(reason.generationRequests, undefined);
});

test('caller-owned immutable cancellation reasons cannot break shared-work cleanup', { timeout: 1000 }, async () => {
  const controller = new AbortController();
  const reason = Object.freeze(Object.assign(new Error('cancelled by caller'), { name: 'AbortError' }));
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const generate = createGenerationPool({ requestMs: 500, keyFor: () => 'same-source', bindResult: value => value,
    generate: async (_input, { onProgress }) => {
      onProgress({ rawText: 'partial completion', generationRequests: 1 }); started();
      await new Promise(resolve => setTimeout(resolve, 20));
      return { generationRequests: 1 };
    } });
  const work = generate({}, { signal: controller.signal });
  const rejected = assert.rejects(work, error => error === reason);
  await ready; controller.abort(reason); await rejected;
  assert.equal((await generate({})).generationRequests, 1);
});

test('a shared external cancellation reason is not overwritten with another source preview', async () => {
  const controller = new AbortController(), reason = new Error('workflow stopped');
  let count = 0, started;
  const ready = new Promise(resolve => { started = resolve; });
  const generate = createGenerationPool({ requestMs: 500, keyFor: input => input.source, bindResult: value => value,
    generate: async (input, { onProgress }) => {
      onProgress({ rawText: input.source, generationRequests: 1 }); if (++count === 2) started();
      await new Promise(resolve => setTimeout(resolve, 20)); return {};
    } });
  const a = generate({ source: 'first job' }, { signal: controller.signal });
  const b = generate({ source: 'second job' }, { signal: controller.signal });
  const rejected = Promise.all([assert.rejects(a, error => error === reason), assert.rejects(b, error => error === reason)]);
  await ready; controller.abort(reason); await rejected;
  assert.equal(reason.rawText, undefined);
});
