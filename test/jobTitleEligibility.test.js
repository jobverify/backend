import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { applyPublicJobLocationScope, buildPublicJobLocationScope } from '../src/utils/publicJobLocationScope.js';
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js';
import { buildPublicationDiagnosticPipeline, summarizePublicationDiagnostics } from '../src/utils/jobPublicationDiagnostics.js';
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js';

test('public Mongo queries hide saved jobs with excluded titles and preserve caller exclusions', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false });
  const collection = mongoose.connection.collection('jobs');
  const now = new Date('2026-11-18T06:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const titles = ['Sales Engineer', 'PreSales Consultant', 'Product MANAGER', 'hr Business Partner', 'Engineer (HR)',
    'Digital MARKETING Specialist', 'Account Executive', 'eXeCuTiVe Assistant',
    'Software Engineer', 'Chrome Engineer', 'Threading Engineer', 'Thrift Platform Engineer', 'Caller excluded engineer'];
  await collection.insertMany(titles.map(title => ({ title, status: 'active', isPublicIndia: true, postedAt: now, source: 'title-fixture',
    jobType: 'Intern', sourceDescription: 'Work with sales, your manager, HR, marketing and the executive team.' })));

  for (const query of [buildPublicJobLocationScope(now), applyPublicJobLocationScope({ status: 'active' }, now),
    applyPublicJobVisibility({ status: 'active' }, {}, now)]) {
    const visible = await collection.find(query).sort({ _id: 1 }).toArray();
    assert.deepEqual(visible.map(job => job.title),
      ['Software Engineer', 'Chrome Engineer', 'Threading Engineer', 'Thrift Platform Engineer', 'Caller excluded engineer']);
  }
  const visible = await collection.find(applyPublicJobVisibility({ status: 'active',
    $nor: [{ title: 'Caller excluded engineer' }] }, {}, now)).sort({ _id: 1 }).toArray();
  assert.deepEqual(visible.map(job => job.title), ['Software Engineer', 'Chrome Engineer', 'Threading Engineer', 'Thrift Platform Engineer']);
  const [diagnostics] = await collection.aggregate(buildPublicationDiagnosticPipeline({ sources: ['title-fixture'], now })).toArray();
  const report = summarizePublicationDiagnostics(diagnostics, { sources: ['title-fixture'], now });
  assert.equal(report.sources[0].visibleJobs, 5);
  assert.deepEqual(report.sources[0].blockingReasonCounts, { excluded_job_title: 8 });
  assert.equal((await refreshJobDatasetSummary()).totalJobs, 5);
  assert.equal(await collection.countDocuments(), 13);
});
