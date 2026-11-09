import assert from 'node:assert/strict';
import test from 'node:test';
import TailoredResume from '../src/models/TailoredResume.js';
import Resume from '../src/models/Resume.js';
import { runTailoredResumeWorker } from '../resume-tailoring/tailoredResumeWorker.js';

const tailored = { kind: 'tailored', row: { _id: 'owner:job', user: 'owner', revision: 2, status: 'queued' } };
const base = { kind: 'base', row: { _id: 'owner', user: 'owner', preparation: { revision: 3, status: 'queued' } } };

test('the default worker deadline allows AI inference and compiler setup within 28 minutes', async () => {
  const before = Date.now();
  let actualDeadline;
  await runTailoredResumeWorker({ nextTask: async () => base,
    prepareRuntime: async ({ deadline }) => {
      actualDeadline = deadline;
      return { stop() {} };
    },
    drain: async () => ({ attempted: 1, completed: 1, failed: 0 }),
  });
  assert.ok(actualDeadline >= before + 28 * 60000 && actualDeadline <= Date.now() + 28 * 60000);
});

test('an empty document queue never downloads or starts a model', async () => {
  assert.deepEqual(await runTailoredResumeWorker({ nextTask: async () => null,
    prepareRuntime: async () => assert.fail('empty queue must not start compute') }), { attempted: 0, completed: 0, failed: 0 });
});

test('one document task shares the absolute deadline and always stops its runtime', async () => {
  const deadline = Date.now() + 60000;
  let stopped = 0;
  const generate = () => {};
  const result = await runTailoredResumeWorker({ deadline, generate, nextTask: async () => base,
    prepareRuntime: async options => { assert.equal(options.deadline, deadline); return { stop: () => { stopped++; } }; },
    drain: async options => {
      assert.equal(options.deadline, deadline); assert.equal(options.generate, generate);
      assert.equal(options.maxTasks, 1); assert.equal(options.task, base);
      return { attempted: 1, completed: 1, failed: 0 };
    },
  });
  assert.equal(stopped, 1);
  assert.deepEqual(result, { attempted: 1, completed: 1, failed: 0 });
});

test('startup failure changes only its original queued tailoring revision', async t => {
  const update = t.mock.method(TailoredResume, 'updateOne', async (filter, change) => {
    assert.deepEqual(filter, { _id: 'owner:job', user: 'owner', revision: 2, status: 'queued', ready: true });
    assert.equal(change.$set.status, 'failed'); assert.equal(change.$set.ready, false);
    assert.doesNotMatch(change.$set.error, /private payload/);
    return { modifiedCount: 1 };
  });
  await assert.rejects(runTailoredResumeWorker({ nextTask: async () => tailored, prepareRuntime: async () => { throw Error('private payload'); } }));
  assert.equal(update.mock.callCount(), 1);
});

test('startup failure also releases a preparation request for explicit retry', async t => {
  t.mock.method(Resume, 'updateOne', async (filter, change) => {
    assert.equal(filter['preparation.revision'], 3); assert.equal(filter['preparation.status'], 'queued');
    assert.equal(change.$set['preparation.status'], 'failed'); return { modifiedCount: 1 };
  });
  await assert.rejects(runTailoredResumeWorker({ nextTask: async () => base, prepareRuntime: async () => { throw Error('private startup'); } }));
  assert.equal(Resume.updateOne.mock.callCount(), 1);
});
