import assert from 'node:assert/strict';
import Job from '../../src/models/Job.js';
import JobDatasetSummary from '../../src/models/JobDatasetSummary.js';
import { getAllJobs } from '../../src/controllers/jobController.js';
import { JOB_DATASET_LIFECYCLE_VERSION } from '../../src/services/jobDatasetSummaryService.js';

const sort = process.argv[2];
JobDatasetSummary.findOne = () => ({
  sort() { return this; }, lean() { return this; },
  exec: () => new Promise(resolve => setTimeout(() => resolve({
    totalJobs: 0, totalCompanies: 0, refreshedAt: new Date(),
    lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION, refreshSequence: 1, publishedSequence: 1,
  }), 40)),
});
const query = () => ({
  select() { return this; }, sort() { return this; }, skip() { return this; },
  limit() { return this; }, lean() { return this; },
  exec: () => Promise.reject(new Error('controlled query failure')),
});
Job.find = query;
Job.aggregate = query;
const res = {
  statusCode: 200, set() { return this; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
};
console.error = () => {};
await getAllJobs({ query: sort === 'recommended' ? { sort } : {},
  user: { role: 'admin' } }, res);
assert.equal(res.statusCode, 500);
assert.equal(res.body.success, false);
// Remain alive beyond the summary resolution and Node's rejection checkpoint.
await new Promise(resolve => setTimeout(resolve, 60));
