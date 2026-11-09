import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import Job from '../../src/models/Job.js'
import { applyPublicJobLocationScope } from '../../src/utils/publicJobLocationScope.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { enrichJobWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { saveToDB } from '../utils/saveToDB.js'

test('exact source recovery survives persistence and makes only the described India role public', { timeout: 60000 }, async t => {
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('External network forbidden in source recovery regression') }
  let mongo
  t.after(async () => {
    await mongoose.disconnect()
    await mongo?.stop()
    globalThis.fetch = originalFetch
  })
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
  mongo = new MongoMemoryServer({
    instance: { ip: '127.0.0.1', launchTimeout: 30_000 },
    spawn: { signal: t.signal },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries/', import.meta.url)) },
  })
  await mongo.start()
  t.signal.throwIfAborted()
  assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
  t.signal.throwIfAborted()
  const now = new Date('2026-10-24T10:00:00.000Z')
  const role = id => ({
    title: 'Platform Engineer', company: 'Source recovery regression', source: 'source-recovery-regression',
    jobId: id, country: 'India', location: 'Bengaluru, India', city: 'Bengaluru',
    sourceUrl: `https://careers.example.com/job/${id}`, sourceDescription: null,
    description: null, jobDescription: null, sourceListingComplete: false, scrapedAt: now.toISOString(),
  })
  const description = '<h2>Responsibilities</h2><p>Design distributed systems and maintain cloud services.</p><h2>Qualifications</h2><p>5 years of software engineering experience required.</p>'
  const enrich = (job, wrongEmployer = false) => enrichJobWithPublicExperience(job, {
    fetchText: async () => ({ status: 200, url: job.sourceUrl, html: `<script type="application/ld+json">${JSON.stringify({
      '@type': 'JobPosting', title: job.title, url: job.sourceUrl, identifier: { value: job.jobId },
      hiringOrganization: { name: wrongEmployer ? 'Other employer' : job.company }, description,
    })}</script>` }),
  })
  const recovered = await enrich(role('R100'))
  const unresolved = await enrich(role('R101'), true)
  const saved = await saveToDB([recovered, unresolved], 'source-recovery-regression', {
    now, enrichPublicExperience: false, enqueueAlerts: false, descriptionRewriteMode: 'off',
    replaceExisting: false, refreshDatasetSummary: false,
  })
  assert.equal(saved.inserted, 2)
  const stored = await Job.findOne({ jobId: 'R100' }).lean()
  assert.equal(stored.sourceDescription, description)
  assert.equal(stored.country, 'India')
  const visible = await Job.find(applyPublicJobLocationScope({ status: 'active' })).lean()
  assert.deepEqual(visible.map(value => value.jobId), ['R100'])
  assert.equal(hasSourceDescription(await Job.findOne({ jobId: 'R101' }).lean()), false)
})
