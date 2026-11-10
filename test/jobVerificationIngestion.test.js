import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';
import { saveToDB } from '../scraper-support/utils/saveToDB.js';

test('scraper upserts keep canonical URL and ATS lookup keys current without replacing source URLs', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => { if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor); else delete mongoose.connection.readyState; });
  t.mock.method(Job, 'find', () => ({ select() { return this; }, lean() { return this; }, exec: async () => [] }));
  const written = [];
  t.mock.method(Job, 'bulkWrite', async operations => { written.push(...operations); return { upsertedCount: operations.length, modifiedCount: 0 }; });
  const sourceUrl = 'https://careers.acme.co.uk/jobs/123?utm_source=email';
  const applyUrl = 'https://jobs.lever.co/acme/abc-def/apply';
  const input = { title: 'Engineering Intern', company: 'Acme', location: 'Bengaluru, India', sourceUrl, applyUrl, link: sourceUrl, description: 'Build accessible web applications.' };
  const options = { enqueueAlerts: false, enrichPublicExperience: false, refreshDatasetSummary: false, replaceExisting: false, classifier: { mode: 'off' } };
  await saveToDB([input], 'acme', options);
  const first = written[0].updateOne.update.$set;
  assert.equal(first.sourceUrl, sourceUrl);
  assert.ok(first.verificationKeys?.includes('url:https://careers.acme.co.uk/jobs/123'));
  assert.ok(first.verificationKeys?.includes('role:lever:global:acme:abc-def'));
  await saveToDB([{ ...input, applyUrl: 'https://jobs.lever.co/acme/replacement' }], 'acme', options);
  const second = written.at(-1).updateOne.update.$set;
  assert.ok(second.verificationKeys?.includes('role:lever:global:acme:replacement'));
  assert.ok(!second.verificationKeys?.includes('role:lever:global:acme:abc-def'));
});
