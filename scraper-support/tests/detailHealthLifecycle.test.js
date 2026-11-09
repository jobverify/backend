import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import { saveToDB } from '../utils/saveToDB.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'

const role = (id, fields = {}) => ({ source: 'detail-lifecycle', company: 'Lifecycle fixture',
  title: `Engineer ${id}`, jobId: id, location: 'Bengaluru, India', country: 'India',
  sourceUrl: `https://example.test/jobs/${id}`, applyUrl: `https://example.test/jobs/${id}`,
  jobDescription: 'Develop and maintain reliable software for customers.', ...fields })
const evidence = jobs => attachInventoryEvidence(jobs, { status: jobs.length ? 'complete-inventory' : 'verified-empty',
  firstParty: true, listingComplete: true, surface: 'https://example.test/jobs', pagesFetched: 1,
  reportedTotal: jobs.length, indiaFacetCount: jobs.length, verifiedAt: new Date().toISOString() })

async function exercise(t, jobs, options = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => descriptor
    ? Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    : delete mongoose.connection.readyState)
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Lifecycle unit tests must not use network'))
  const previous = { jobId: 'R2', jobDescription: 'Previously verified employer description.',
    status: 'active', missedScrapeCount: 1 }
  const priorState = structuredClone(previous)
  const writes = []
  const cleanup = []
  t.mock.method(Job, 'bulkWrite', async operations => {
    writes.push(...operations)
    return { upsertedCount: operations.length, modifiedCount: 0 }
  })
  t.mock.method(Job, 'deleteMany', filter => {
    cleanup.push({ operation: 'delete', filter })
    previous.status = 'deleted'
    return { exec: async () => ({ deletedCount: 1 }) }
  })
  t.mock.method(Job, 'updateMany', (filter, update) => {
    cleanup.push({ operation: 'miss', filter, update })
    previous.missedScrapeCount++
    return { exec: async () => ({ modifiedCount: 1 }) }
  })
  const result = await saveToDB(jobs, 'detail-lifecycle', { enrichPublicExperience: false,
    enqueueAlerts: false, descriptionRewriteMode: 'off', refreshDatasetSummary: false,
    missesBeforeExpiry: 2, ...options })
  return { result, writes, cleanup, previous, priorState }
}

for (const [name, missing] of [
  ['explicit missing Workday details', { jobDescription: null, sourceDetailComplete: false, sourceDetailFailureKind: 'budget-exhausted' }],
  ['missing India employer content without adapter flags', { jobDescription: '' }],
  ['explicit incomplete detail despite a nonempty summary', { sourceDetailComplete: false, sourceDetailFailureKind: 'upstream' }],
]) test(`mixed current roles preserve prior vacancies with ${name}`, async t => {
  const jobs = evidence([role('R1'), role('R2', missing)])
  const { result, writes, cleanup, previous, priorState } = await exercise(t, jobs)
  assert.ok(writes.some(operation => operation.updateOne.update.$set.jobId === 'R1'))
  assert.deepEqual(cleanup, [])
  assert.deepEqual(previous, priorState)
  assert.equal(result.staleCheckSkipped, true)
  assert.match(result.staleCheckReason, /details.*incomplete|incomplete.*details/i)
  assert.deepEqual([result.deleted, result.missed, result.expired], [0, 0, 0])
})

test('an authoritative-empty option cannot override missing details on enumerated India jobs', async t => {
  const { result, cleanup } = await exercise(t, evidence([role('R2', { jobDescription: '' })]), { authoritativeEmpty: true })
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.staleCheckSkipped, true)
  assert.deepEqual(cleanup, [])
})

test('a fully described current listing still permits normal lifecycle reconciliation', async t => {
  const { result, cleanup } = await exercise(t, evidence([role('R1', { sourceDetailComplete: true })]))
  assert.equal(result.staleCheckSkipped, false)
  assert.deepEqual(cleanup.map(c => c.operation), ['delete', 'miss'])
  assert.equal(result.missed, 2)
})

test('verified complete empty inventory retains explicitly authorized empty lifecycle behavior', async t => {
  const { result, cleanup } = await exercise(t, evidence([]), { authoritativeEmpty: true })
  assert.equal(result.staleCheckSkipped, false)
  assert.deepEqual(cleanup.map(c => c.operation), ['delete', 'miss'])
})

test('missing foreign descriptions do not suppress complete India reconciliation without explicit detail flags', async t => {
  const { result, cleanup } = await exercise(t, evidence([role('R1'), role('F1', {
    location: 'London, United Kingdom', country: 'United Kingdom', jobDescription: '',
  })]))
  assert.equal(result.filteredNonIndia, 1)
  assert.equal(result.filteredEmptyDescription, 0)
  assert.equal(result.staleCheckSkipped, false)
  assert.deepEqual(cleanup.map(c => c.operation), ['delete', 'miss'])
})

test('unreturned native detail failures preserve prior vacancies despite complete returned roles', async t => {
  const jobs = evidence([role('R1', { sourceDetailComplete: true, sourceListingComplete: true,
    nativeCollectionEvidence: { source: 'detail-lifecycle', observedListingCount: 2, candidateDetails: 2,
      jobs: [{ id: 'R1' }], exclusions: [], failures: [{ stage: 'native-detail' }],
      listingPaginationComplete: true, closingInventoryMatches: true, sourceScopeComplete: true } })])
  const { result, cleanup, previous, priorState } = await exercise(t, jobs)
  assert.equal(result.staleCheckSkipped, true)
  assert.match(result.staleCheckReason, /details.*incomplete|incomplete.*details/i)
  assert.deepEqual(cleanup, [])
  assert.deepEqual(previous, priorState)
})

test('unknown native detail counts cannot authorize lifecycle cleanup', async t => {
  const jobs = evidence([role('R1', { sourceDetailComplete: true, sourceListingComplete: true,
    nativeCollectionEvidence: { source: 'detail-lifecycle', candidateDetails: 2,
      listingPaginationComplete: true, closingInventoryMatches: true } })])
  const { result, cleanup, previous, priorState } = await exercise(t, jobs)
  assert.equal(result.staleCheckSkipped, true)
  assert.deepEqual(cleanup, [])
  assert.deepEqual(previous, priorState)
})

test('known complete native details retain normal explicitly complete inventory reconciliation', async t => {
  const jobs = evidence([role('R1', { sourceDetailComplete: true, sourceListingComplete: true,
    nativeCollectionEvidence: { source: 'detail-lifecycle', observedListingCount: 1, candidateDetails: 1,
      jobs: [{ id: 'R1' }], exclusions: [], failures: [],
      listingPaginationComplete: true, closingInventoryMatches: true, sourceScopeComplete: true } })])
  const { result, cleanup } = await exercise(t, jobs)
  assert.equal(result.staleCheckSkipped, false)
  assert.deepEqual(cleanup.map(c => c.operation), ['delete', 'miss'])
})
