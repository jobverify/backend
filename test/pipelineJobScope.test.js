import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfiguration, validateConfiguration, directConfiguration } from '../src/pipeline/policy.js';
import { pipelineJobFilter, loadPipelineJobFilter } from '../src/pipeline/jobScope.js';

const start = new Date('2026-11-16T10:00:00Z');
const end = new Date('2026-11-16T11:00:00Z');
const run = (all = false) => ({ _id: 'test-pipeline', stages: [
  { key: 'scraper', enabled: true, status: 'completed', startedAt: start, completedAt: end },
  { key: 'rewrite', enabled: true, runForAllExistingJobs: all },
  { key: 'classification', enabled: true, runForAllExistingJobs: all },
] });

test('processing scope defaults to new jobs and validates each independent toggle', () => {
  for (const stage of defaultConfiguration().stages.filter(s => s.key !== 'scraper')) {
    assert.equal(stage.runForAllExistingJobs, false);
  }
  const config = validateConfiguration({ stages: run().stages.map(s => ({ ...s,
    runForAllExistingJobs: s.key === 'rewrite',
  })) });
  assert.equal(config.stages[1].runForAllExistingJobs, true);
  assert.equal(config.stages[2].runForAllExistingJobs, false);
  assert.deepEqual(directConfiguration('rewrite', config).stages.slice(1), config.stages.slice(1));
  assert.equal(Object.hasOwn(config.stages[0], 'runForAllExistingJobs'), false);
  for (const value of ['false', 1, null, {}]) {
    assert.throws(() => validateConfiguration({ stages: run().stages.map(s => s.key === 'rewrite'
      ? { ...s, runForAllExistingJobs: value } : s) }), error => error.status === 400);
  }
});

test('new jobs selection uses exact inserting pipeline ownership, never observation timestamps', () => {
  for (const key of ['rewrite', 'classification']) {
    assert.deepEqual(pipelineJobFilter(run(), key), { firstSeenPipelineId: 'test-pipeline' });
    assert.deepEqual(pipelineJobFilter(run(true), key), {});
  }
  const independent = run();
  independent.stages[1].runForAllExistingJobs = true;
  assert.deepEqual(pipelineJobFilter(independent, 'rewrite'), {});
  assert.deepEqual(pipelineJobFilter(independent, 'classification'), { firstSeenPipelineId: 'test-pipeline' });
});

test('without a preceding completed scraper new jobs selection is empty', () => {
  for (const status of ['waiting', 'disabled', 'running', 'failed']) {
    const pipeline = run(); pipeline.stages[0].status = status;
    assert.deepEqual(pipelineJobFilter(pipeline, 'rewrite'), { _id: { $in: [] } });
  }
  const reordered = run(); reordered.stages.reverse();
  assert.deepEqual(pipelineJobFilter(reordered, 'classification'), { _id: { $in: [] } });
  const missing = run(); missing.stages.shift();
  assert.deepEqual(pipelineJobFilter(missing, 'rewrite'), { _id: { $in: [] } });
});

test('legacy in-flight pipelines retain scope and invalid identities fail closed', async () => {
  const legacy = run(); delete legacy.stages[1].runForAllExistingJobs;
  assert.deepEqual(pipelineJobFilter(legacy, 'rewrite'), {});
  assert.throws(() => pipelineJobFilter(run(), 'unknown'), /stage/i);
  const invalid = run(); delete invalid._id;
  assert.throws(() => pipelineJobFilter(invalid, 'rewrite'), /identity/i);
  await assert.rejects(loadPipelineJobFilter('rewrite', { pipelineId: 'missing', model: {
    findById: () => ({ lean: async () => null }),
  } }), /not found/i);
  assert.deepEqual(await loadPipelineJobFilter('rewrite', { pipelineId: '' }), {});
});
