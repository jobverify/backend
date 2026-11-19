import test from 'node:test'
import assert from 'node:assert/strict'
import { getScraperCatalog } from '../providers/index.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const role = (id, overrides = {}) => ({
  id, displayJobId: `REQ-${id}`, name: 'Software Engineer',
  locations: ['Pune, Maharashtra, India'], standardizedLocations: ['Pune, MH, IN'],
  positionUrl: `/careers/job/${id}`, ...overrides,
})
const conflict = role(2, {
  locations: ['IND, 590013', 'Belagavi, Karnataka, India'],
  standardizedLocations: ['Singapore, SG', 'Belagavi, KA, IN'],
})
const eatonProvider = getScraperCatalog().find(item => item.source === 'eaton')
const run = async (rows, { optIn = true, detailChange } = {}) => {
  const provider = structuredClone(eatonProvider)
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0 }
  if (!optIn) delete provider.publicAccessPolicy
  const details = []
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    const endpoint = new URL(url)
    if (endpoint.pathname.endsWith('/search')) return { data: { positions: rows, count: rows.length } }
    const id = Number(endpoint.searchParams.get('position_id'))
    details.push(id)
    const native = rows.find(item => item.id === id)
    const data = { ...native, publicUrl: `https://jobs.eaton.com/careers/job/${id}`,
      jobDescription: '<p>Design reliable software systems and maintain production services with our engineering team.</p>' }
    detailChange?.(data)
    return { data }
  } })
  return { jobs, details }
}

test('Eaton country and postal-only labels retain their explicit country without inventing a city', () => {
  for (const [raw, normalized] of [['IND, 600119', 'Chennai, TN, IN'], ['IND, 530041', 'Visakhapatnam, AP, IN']]) {
    const scope = readEightfoldLocationScope({ locations: [raw], standardizedLocations: [normalized] })
    assert.equal(scope.country, 'India')
    assert.equal(scope.location, raw)
    assert.equal(scope.unresolved, false)
  }
  assert.throws(() => readEightfoldLocationScope(conflict), /contradictory explicit native country/)
  assert.throws(() => readEightfoldLocationScope({ locations: ['600119'], standardizedLocations: ['Chennai, TN, IN'] }), /unaligned/)
})

test('opted-in Eightfold acquisition retains safe jobs and quarantines a conflicting native location record', async () => {
  const { jobs, details } = await run([conflict, role(1)])
  assert.deepEqual(jobs.map(job => job.jobId), [1])
  assert.deepEqual(details, [1])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /native-location-record-rejected/)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.rejectedNativeRecords.length, 1)
  assert.deepEqual(jobs.nativeCollectionEvidence.rejectedNativeRecords[0].nativeRecord, conflict)
})

test('only conflicting records cannot become a verified empty Eightfold inventory', async () => {
  const { jobs, details } = await run([conflict])
  assert.equal(jobs.length, 0)
  assert.deepEqual(details, [])
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Eightfold record quarantine requires the existing opt-in and never hides mismatched detail identities', async () => {
  await assert.rejects(run([conflict, role(1)], { optIn: false }), /native location scope/)
  await assert.rejects(run([role(1)], { detailChange: detail => { detail.id = 99 } }), /identity mismatch: id/)
})
