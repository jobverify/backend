import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, OPENINGS_API_URL } from '../scraper/ixigo/script.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// Authentic November 4 responses. No current-availability claim is made here.
const fixtureBytes = readFileSync(new URL('./test-data/ixigoCompensation20261108/nov4-original-capture.json.gz', import.meta.url))
const sha = value => createHash('sha256').update(value).digest('hex')
assert.equal(sha(fixtureBytes), '49fc7f3324c5b4801638dac4b5caadab8f3616047a0b600a9fbf990a205b9e64')
const capture = JSON.parse(gunzipSync(fixtureBytes, { maxOutputLength: 2_000_000 }))
assert.equal(capture.source, 'ixigo')
for (const record of capture.requests) {
  assert.equal(sha(record.text), record.bodySHA256)
  assert.equal(Buffer.byteLength(record.text), record.bodyBytes)
}

const detailUrl = 'https://api.smartrecruiters.com/v1/companies/ixigo/postings/12112426538'
const publishedCompensation = { min: 1, max: 300000, currency: 'INR', period: 'MONTHLY' }
assert.deepEqual(JSON.parse(capture.requests.find(record => record.requestedURL === detailUrl).text).compensation, publishedCompensation)
const originalCompensation = Symbol('use original response without modification')
const absentCompensation = Symbol('synthetic response with no compensation key')

// The source's injected response reader is a closed occurrence tape. Variants
// below are explicitly synthetic negative/boundary cases derived from that tape.
async function collect(compensation = originalCompensation, expectedClosingAttempts = 1) {
  let ordinal = 0, missingClosingAttempts = 0
  const jobs = await run({ fetchPage: async url => {
    if (ordinal === capture.requests.length) {
      assert.equal(url, OPENINGS_API_URL)
      missingClosingAttempts++
      // The authentic Nov4 recording has no closing response. Never synthesize
      // one from the opening body to make an old recording look complete.
      throw new Error('Authentic Nov4 tape contains no closing response')
    }
    const record = capture.requests[ordinal++]
    assert.ok(record, 'Unexpected request: offline tape has no network fallback')
    assert.equal(url, record.requestedURL)
    let html = record.text
    if (url === detailUrl && compensation !== originalCompensation) {
      const detail = JSON.parse(html)
      if (compensation === absentCompensation) delete detail.compensation
      else detail.compensation = compensation
      html = JSON.stringify(detail)
    }
    return { status: record.status, url: record.finalURL, html }
  } })
  assert.equal(ordinal, capture.requests.length)
  assert.equal(missingClosingAttempts, expectedClosingAttempts)
  assert.equal(jobs.length, 7)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  return jobs.find(job => job.jobId === '12112426538')
}

test('ixigo preserves employer pay through the source and normalized salary contract', async () => {
  const job = await collect()
  const normalized = normalizeScrapedJob(job, { source: 'ixigo' })
  assert.equal(normalized.salary, 'INR 1 - 300000 per month')
  assert.equal(job.salary, 'INR 1 - 300000 per month')
  assert.equal(normalized.sourceDescription, job.sourceDescription)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
})

for (const [label, compensation, expected, expectedClosingAttempts = 1] of [
  ['zero pay without turning it into missing data', { min: 0, max: 0, currency: 'INR', period: 'MONTHLY' }, 'INR 0 per month'],
  ['a lower bound without inventing an upper bound', { min: 25000, currency: 'INR', period: 'MONTHLY' }, 'INR from 25000 per month'],
  ['an upper bound without inventing a lower bound', { max: 40000, currency: 'INR', period: 'MONTHLY' }, 'INR up to 40000 per month'],
  ['an unfamiliar stated period without conversion', { min: 10, max: 20, currency: 'INR', period: 'FORTNIGHTLY' }, 'INR 10 - 20 (FORTNIGHTLY)'],
  ['missing compensation without fabricating pay', absentCompensation, null],
  ['empty compensation without fabricating pay', {}, null],
  ['reversed bounds without publishing a misleading range', { min: 40000, max: 25000, currency: 'INR', period: 'MONTHLY' }, null, 0],
  ['string amounts without coercing them into published numbers', { min: '25000', max: 40000, currency: 'INR', period: 'MONTHLY' }, null, 0],
  ['negative bounds without publishing invalid pay', { min: -1, max: 40000, currency: 'INR', period: 'MONTHLY' }, null, 0],
  ['an invalid currency without inventing its unit', { min: 1, max: 10, currency: 'rupees<script>', period: 'MONTHLY' }, null, 0],
]) test('ixigo maps ' + label, async () => {
  const job = await collect(compensation, expectedClosingAttempts)
  assert.equal(normalizeScrapedJob(job, { source: 'ixigo' }).salary, expected)
  if (expected !== null) assert.equal(job.salary, expected)
})
