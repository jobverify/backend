import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../../src/models/Job.js'
import { buildPublicJobLocationScope } from '../../src/utils/publicJobLocationScope.js'
import { enrichJobWithPublicExperience } from '../utils/publicExperienceEnrichment.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

test('native API recovery retains lifecycle dates through Mongo public visibility', { timeout: 60000 }, async t => {
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('External network forbidden in provider lifecycle regression') }
  let mongo
  t.after(async () => { await mongoose.disconnect(); await mongo?.stop(); globalThis.fetch = originalFetch })
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
  mongo = new MongoMemoryServer({ instance: { ip: '127.0.0.1' },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries/', import.meta.url)) } })
  await mongo.start()
  assert.match(mongo.getUri(), /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(mongo.getUri(), { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
  const now = new Date('2026-10-24T10:00:00Z')
  const native = JSON.parse(readFileSync(new URL('./fixtures/public-provider-content/oracle-detail.json', import.meta.url)))
  const expected = native.items[0]
  const input = normalizeScrapedJob({ title: expected.Title, company: 'Zensar', source: 'zensar', jobId: expected.Id,
    sourceUrl: `https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/${expected.Id}`,
    country: 'India', location: expected.PrimaryLocation, sourceDescription: null,
    scrapedAt: now.toISOString(),
  })
  for (const [name, changes] of [
    ['active', {}], ['expired', { ExternalPostedEndDate: '2020-01-01T00:00:00Z' }],
    ['future', { ExternalPostedStartDate: '2030-01-01T00:00:00Z', ExternalPostedEndDate: '2031-01-01T00:00:00Z' }],
  ]) {
    const payload = structuredClone(native)
    Object.assign(payload.items[0], changes)
    const recovered = await enrichJobWithPublicExperience(input, {
      fetchText: async url => ({ status: 200, url, html: '<app-root></app-root>' }),
      fetchJson: async url => ({ status: 200, url, payload }),
    })
    const normalized = normalizeScrapedJob(recovered)
    assert.match(normalized.sourceDescription, /Role Overview|Responsibilities|recruit/i)
    await Job.create({ ...normalized, fingerprint: 'provider-lifecycle-' + name,
      title: name, status: 'active', isPublicIndia: true })
  }
  const visible = await Job.find(buildPublicJobLocationScope(now)).lean()
  assert.deepEqual(visible.map(job => job.title), ['active'])
  assert.equal((await Job.findOne({ title: 'expired' }).lean()).closingDate.toISOString(), '2020-01-01T00:00:00.000Z')
  assert.equal((await Job.findOne({ title: 'future' }).lean()).postedAt.toISOString(), '2030-01-01T00:00:00.000Z')
})
