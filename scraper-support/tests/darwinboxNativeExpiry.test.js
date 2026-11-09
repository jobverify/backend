import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const native = JSON.parse(readFileSync(new URL('./fixtures/darwinbox/leadsquared-expired-native-record.json', import.meta.url), 'utf8'))
const capturedAt = new Date('2026-10-20T19:14:35.698Z')
const scraper = createDarwinboxScraper({ source: 'leadsquared', companyName: 'LeadSquared', origin: 'https://leadsquaredhrms.darwinbox.in' })
const publicJob = overrides => ({ title: 'Software Engineer', location: 'Chennai, India', country: 'India', applyUrl: 'https://example.com/job', jobDescription: 'Build employer software services.', ...overrides })

test('Darwinbox retains the exact native LeadSquared closing epoch without adjusting its date', () => {
  const job = scraper.extractSearchResults({ data: [native] })[0]
  assert.equal(native.job_posting.careers.to, 1792520999)
  assert.equal(job.closingDate, '2026-10-20T18:29:59.000Z')
  assert.equal(job.sourceClosingDateIsExact, true)
  const analysis = analyzePublishableJobs([{ ...job, country: 'India' }], { now: capturedAt })
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.closed, 1)
})

test('Darwinbox exact expiry preserves enumerated India/raw inventory counts and employer content', async () => {
  const jobs = await scraper.run({ fetchListingPage: async () => ({ status: 'success', job_counts: 1, data: [native] }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, native.id)
  assert.ok(jobs[0].jobDescription)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  const analysis = analyzePublishableJobs([{ ...jobs[0], country: 'India' }], { now: capturedAt })
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.closed, 1)
})

test('exact source expiry rejects past and equal instants while future/unknown and legacy date-only rules remain intact', () => {
  const now = new Date('2026-10-20T19:00:00.000Z')
  const jobs = [
    publicJob({ jobId: 'exact-past', closingDate: '2026-10-20T18:29:59.000Z', sourceClosingDateIsExact: true }),
    publicJob({ jobId: 'exact-equal', closingDate: now.toISOString(), sourceClosingDateIsExact: true }),
    publicJob({ jobId: 'exact-future', closingDate: '2026-10-20T19:00:00.001Z', sourceClosingDateIsExact: true }),
    publicJob({ jobId: 'legacy-date', closingDate: '2026-10-20' }),
    publicJob({ jobId: 'legacy-time', closingDate: '2026-10-20T18:29:59.000Z' }),
    publicJob({ jobId: 'unknown', closingDate: null }),
    publicJob({ jobId: 'not-boolean-flag', closingDate: '2026-10-20T18:29:59.000Z', sourceClosingDateIsExact: 'true' }),
  ]
  const analysis = analyzePublishableJobs(jobs, { now })
  assert.deepEqual(analysis.eligibleJobs.map(j => j.jobId), ['exact-future', 'legacy-date', 'legacy-time', 'unknown', 'not-boolean-flag'])
  assert.equal(analysis.filterCounts.closed, 2)
})

test('known exact expiry is counted before missing description, with actual detail-health cause retained', () => {
  const analysis = analyzePublishableJobs([publicJob({ jobDescription: '', closingDate: '2026-10-20T18:29:59.000Z', sourceClosingDateIsExact: true, sourceDetailComplete: false, sourceDetailFailureKind: 'missing-content' })], { now: capturedAt })
  assert.equal(analysis.filterCounts.closed, 1)
  assert.equal(analysis.filterCounts.emptyDescription, 0)
})

for (const to of [false, '', 'invalid', -1, 0, Infinity, 1e20, {}]) test('Darwinbox rejects malformed explicit native closing epoch ' + String(to), async () => {
  const record = { ...native, job_posting: { careers: { to } } }
  await assert.rejects(scraper.run({ fetchListingPage: async () => ({ status: 'success', job_counts: 1, data: [record] }) }), e => e.name === 'DarwinboxListingContractError')
})
