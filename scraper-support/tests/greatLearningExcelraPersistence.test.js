import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import { generateFingerprint, saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })
import { run as greatLearning } from '../../scraper/greatlearning/script.js'
import { run as excelra } from '../../scraper/excelraknowledgesolutions/script.js'

const fixture = file => readFileSync(new URL('./fixtures/' + file, import.meta.url), 'utf8')
const nativeGreatLearning = JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261107/greatlearning-current.json.gz', import.meta.url))))
const nativePages = new Map(nativeGreatLearning.packets.map(p => [p.requestedURL, p]))
for (const [source, count, run] of [
  ['greatlearning', 4, () => greatLearning({ now: () => '2026-11-07T00:00:00.000Z', fetchResponse: async url => { const p = nativePages.get(url);assert.ok(p);return {...p, bytes: Buffer.from(p.bodyBase64, 'base64')} } })],
  ['excelraknowledgesolutions', 7, () => excelra({ fetchJson: async () => JSON.parse(fixture('excelraknowledgesolutions/current-openings.json')) })],
]) test(source + ' preserves every recovered role through real persistence despite shared application URLs', async t => {
  const state = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => { if (state) Object.defineProperty(mongoose.connection, 'readyState', state); else delete mongoose.connection.readyState })
  let writes = []
  t.mock.method(Job, 'bulkWrite', async operations => { writes = operations; return { modifiedCount: 0, upsertedCount: operations.length } })
  t.mock.method(Job, 'updateMany', () => ({ exec: async () => ({ modifiedCount: 0 }) }))
  t.mock.method(Job, 'deleteMany', () => ({ exec: async () => ({ deletedCount: 0 }) }))
  const jobs = await run()
  assert.equal(jobs.length, count)
  assert.ok(jobs.every(job => job.applicationUrlIsGeneric === true))
  if (source === 'greatlearning') assert.ok(jobs.every(job => job.requisitionId === null && job.jobId === null && job.nativeIdentity.kind === 'published-role-url' && job.sourceDetailComplete))
  else assert.ok(jobs.every(job => job.requisitionId))
  assert.equal(new Set(jobs.map(generateFingerprint)).size, count)
  const result = await saveToDB(jobs, source, { enrichPublicExperience: false, refreshDatasetSummary: false })
  assert.equal(writes.length, count)
  assert.equal(new Set(writes.map(operation => operation.updateOne.filter.fingerprint)).size, count)
  assert.equal(result.inserted, count)
})
