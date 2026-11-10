import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';
import JobDatasetSummary from '../src/models/JobDatasetSummary.js';
import { readJobDatasetSummary, refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js';

test('public summary budgets cover reservation, aggregation and publication', async t => {
  const id = new mongoose.Types.ObjectId();
  const calls = [];
  const query = value => ({ sort() { return this; }, lean() { return this; }, exec: async () => value });
  t.mock.method(JobDatasetSummary, 'findOne', (_filter, _projection, options) => {
    calls.push(['read', options]); return query({ _id: id });
  });
  t.mock.method(JobDatasetSummary, 'findOneAndUpdate', (_filter, _update, options) => {
    calls.push(['write', options]); return query({ _id: id, refreshSequence: 1 });
  });
  t.mock.method(Job, 'aggregate', (_pipeline, options) => {
    calls.push(['aggregate', options]); return query([]);
  });
  await readJobDatasetSummary({ maxTimeMS: 800 });
  await refreshJobDatasetSummary({ maxTimeMS: 800 });
  assert.deepEqual(calls.map(([kind]) => kind), ['read', 'read', 'write', 'aggregate', 'write']);
  for (const [kind, options] of calls) assert.equal(options?.maxTimeMS, 800, kind);
});
