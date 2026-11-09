import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from './script.js';

test('HPE starts four independent native details together and retains their complete descriptions', async () => {
  const rows = Array.from({ length: 4 }, (_, i) => ({ reqId: String(i + 1), jobId: String(i + 1),
    title: 'Engineer ' + (i + 1), country: 'India', cityStateCountry: 'Bengaluru, India' }));
  let started = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const jobs = await run({ detailEnrichmentBudgetMs: 1000, fetchText: async url => {
    if (url.includes('/search-results')) return '<script>phApp.ddo = ' + JSON.stringify({
      eagerLoadRefineSearch: { totalHits: 4, hits: 4, data: { jobs: rows,
        aggregations: [{ field: 'country', value: { India: 4 } }] } },
    }) + '</script>';
    if (++started === 4) release();
    await barrier;
    const row = rows.find(job => url.includes('/job/' + job.jobId + '/'));
    return '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: { data: { job: {
      ...row, ml_country: 'India', ml_Description: '<p>Build and maintain customer software services.</p>',
    } } } }) + '</script>';
  } });
  assert.equal(started, 4);
  assert.equal(jobs.length, 4);
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.jobDescription === 'Build and maintain customer software services.'));
});
