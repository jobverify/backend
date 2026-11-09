import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { normalizeJobListResponseJob } from '../src/controllers/jobController.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../src/utils/publicJobType.js';
import { applyPublicJobLocationScope } from '../src/utils/publicJobLocationScope.js';

const fixtures = [
  { title: 'Engineer', jobType: 'Full-time', sourceDescription: 'Develop enterprise applications.', sourceContentHashVersion: 2, sourceContentHash: 'private-input-hash', descriptionRewrite: { status: 'published' }, description: 'Recent graduates welcome.' },
  { title: 'Engineer', jobType: 'Full-time', sourceDescription: 'Recent graduates welcome.', description: 'Develop enterprise applications.' },
  { title: 'Engineer', jobType: 'Full-time', experienceRequired: 'At least 3 years', sourceDescription: 'At least 3 years of software development experience is required.', description: 'Recent graduates welcome.' },
];
test('public response hides source provenance and keeps display wording out of categories', () => {
  const result = normalizeJobListResponseJob(fixtures[0]);
  assert.equal(result.jobType, 'Unspecified');
  assert.equal(result.sourceDescription, undefined);
  assert.equal(result.sourceContentHashVersion, undefined);
  assert.equal(result.sourceContentHash, undefined);
  assert.equal(result.descriptionRewrite, undefined);
  assert.equal(result.description, fixtures[0].description);
  assert.equal(normalizeJobListResponseJob(fixtures[1]).jobType, 'Full-time Fresher');
  assert.equal(normalizeJobListResponseJob(fixtures[2]).jobType, 'Full-time Experienced');
});
test('Mongo pagination/category decisions use preserved source and match public responses', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const collection = mongoose.connection.collection('source_description_visibility');
  await collection.insertMany(structuredClone(fixtures));
  const actual = await collection.aggregate([{ $project: { category: PUBLIC_JOB_TYPE_EXPRESSION } }]).toArray();
  assert.deepEqual(actual.map(row => row.category), ['Unspecified', 'Full-time Fresher', 'Full-time Experienced']);
  assert.deepEqual(actual.map(row => row.category), fixtures.map(job => normalizeJobListResponseJob(job).jobType));
});

test('public query hides previously saved empty source descriptions, including blank HTML', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  t.after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri());
  const collection = mongoose.connection.collection('empty_description_visibility');
  const empty = [undefined, null, '', ' \n\t\u00a0\u200b', '<p>&nbsp;<br></p>', '<!-- note --><script>ignored()</script>', '&#160;&#xA0;', '<br>'.repeat(10000), '<script>' + 'ignored();'.repeat(10000) + '</script>'];
  await collection.insertMany([
    ...empty.map((sourceDescription, index) => ({ title: `empty-${index}`, status: 'active', isPublicIndia: true,
      ...(sourceDescription === undefined ? {} : { sourceDescription, description: 'Generated wording cannot supply missing source content.' }) })),
    { title: 'placeholder', status: 'active', isPublicIndia: true, sourceDescription: '<p>Enter job description</p>', description: 'Enter job description\n\nLocation: Bangalore' },
    { title: 'legacy', status: 'active', isPublicIndia: true, description: 'Build APIs.' },
    { title: 'source', status: 'active', isPublicIndia: true, sourceDescription: '\u00a0'.repeat(10000) + '<script></script><!-- spacer -->'.repeat(100) + '<p>Build APIs.</p>' },
    { title: 'alias', status: 'active', isPublicIndia: true, jobDescription: 'Build APIs.' },
    { title: 'foreign', status: 'active', isPublicIndia: false, description: 'Build APIs.' },
  ]);
  const visible = await collection.find(applyPublicJobLocationScope({ status: 'active' })).toArray();
  assert.deepEqual(visible.map(job => job.title), ['legacy', 'source', 'alias']);
});
