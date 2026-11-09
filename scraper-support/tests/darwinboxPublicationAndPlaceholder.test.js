import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const native = JSON.parse(readFileSync(new URL('../../scraper/darwinbox/test-data/native-publication-and-placeholder-20261102.json', import.meta.url), 'utf8'))
const scraper = createDarwinboxScraper({ source: 'caratlane', companyName: 'CaratLane', origin: 'https://caratlane.darwinbox.in' })

test('Darwinbox normalizes current native publication seconds and retains the exact publisher values', () => {
  const record = native.caratlane.record
  const [job] = scraper.extractSearchResults({ data: [record] })
  assert.equal(job.postingDate, '2023-06-12T18:30:00.000Z')
  assert.equal(job.sourcePostingDate, job.postingDate)
  assert.equal(job.sourceDateEvidence, 'darwinbox-native-posted-on-v1')
  assert.equal(job.sourceNativePostedOn, record.posted_on)
  assert.equal(job.sourceNativeCareersFrom, record.job_posting.careers.from)
  const analysis = analyzePublishableJobs([{ ...job, country: 'India' }], { now: new Date('2026-11-02T16:55:00.000Z') })
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.old, 1)
})

test('Darwinbox preserves human-readable publication dates and never substitutes created/updated events', () => {
  const record = { ...native.caratlane.record, posted_on: '23-Jun-2026', created_on: '2026-11-02T00:00:00Z', updated_on: 1793557800 }
  assert.equal(scraper.extractSearchResults({ data: [record] })[0].postingDate, '23-Jun-2026')
  delete record.posted_on
  assert.equal(scraper.extractSearchResults({ data: [record] })[0].postingDate, null)
})

test('Darwinbox retains the original scalar type for numeric-string publication evidence', () => {
  const record = structuredClone(native.caratlane.record)
  record.posted_on = String(record.posted_on)
  const [job] = scraper.extractSearchResults({ data: [record] })
  assert.equal(job.postingDate, '2023-06-12T18:30:00.000Z')
  assert.equal(job.sourceNativePostedOn, record.posted_on)
})

for (const posted_on of [0, -1, 1.5, Infinity, 1e20]) test('Darwinbox rejects invalid native publication seconds ' + String(posted_on), () => {
  const record = structuredClone(native.caratlane.record)
  record.posted_on = posted_on
  assert.throws(() => scraper.extractSearchResults({ data: [record] }), error => error.name === 'DarwinboxListingContractError' && error.abortRetries === true)
})

test('Darwinbox rejects conflicting native publication events before certifying an inventory', async () => {
  const record = structuredClone(native.caratlane.record)
  record.job_posting.careers.from += 86400
  await assert.rejects(scraper.run({ fetchListingPage: async () => ({ status: 'success', data: [record], job_counts: 1 }) }), error => error.name === 'DarwinboxListingContractError')
})

const placeholderRecord = jd => ({ ...native.bigbasket.record, jd })
const detail = jd => ({ status: 'success', message: { job: [{ id: native.bigbasket.record.id, title: native.bigbasket.record.title, officelocation_show_arr: 'Bangalore, Karnataka, India', jd }] } })

for (const placeholder of ['Please enter job description', '<p>Please enter the job description.</p>', 'Enter job description']) test('Darwinbox inspects the role detail for native placeholder ' + placeholder, async () => {
  let calls = 0
  const jobs = await scraper.run({
    fetchListingPage: async () => ({ status: 'success', data: [placeholderRecord(placeholder)], job_counts: 1 }),
    fetchJobDetail: async () => { calls++; return detail('<p>Recruit and onboard candidates for the employer operations team.</p>') },
  })
  assert.equal(calls, 1)
  assert.equal(jobs[0].sourceNativeListingDescription, placeholder)
  assert.match(jobs[0].jobDescription, /Recruit and onboard/)
  assert.equal(jobs[0].sourceDetailComplete, true)
})

test('Darwinbox preserves genuine missing content when both public descriptions are placeholders', async () => {
  const jobs = await scraper.run({
    fetchListingPage: async () => ({ status: 'success', data: [native.bigbasket.record], job_counts: 1 }),
    fetchJobDetail: async () => detail('<p>Please enter job description</p>'),
  })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDescription, undefined)
  assert.equal(hasSourceDescription(jobs[0]), false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].sourceNativeListingDescription, native.bigbasket.record.jd)
  assert.equal(jobs[0].sourceNativeDetailDescription, '<p>Please enter job description</p>')
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Darwinbox blocked placeholder detail stays incomplete and retains no fabricated criteria', async () => {
  const jobs = await scraper.run({
    fetchListingPage: async () => ({ status: 'success', data: [native.bigbasket.record], job_counts: 1 }),
    fetchJobDetail: async () => { throw Object.assign(new Error('Public detail blocked'), { status: 403 }) },
  })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDescription, undefined)
  assert.equal(hasSourceDescription(jobs[0]), false)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'upstream')
})

test('Darwinbox retains an actual description containing a request to enter a description as part of a larger duty', async () => {
  const description = '<p>Please enter job description in the recruiting tool when creating each vacancy. Review the candidates and coordinate interviews.</p>'
  const jobs = await scraper.run({ fetchListingPage: async () => ({ status: 'success', data: [placeholderRecord(description)], job_counts: 1 }), fetchJobDetail: async () => { throw new Error('Complete criteria should not fetch') } })
  assert.equal(jobs[0].jobDescription, description)
  assert.notEqual(jobs[0].sourceDetailComplete, false)
})
