import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCdacScraper, extractSearchResults, CAREER_PAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz', import.meta.url))))
const replay = ({ corrupt } = {}) => ({
  fetchText: async url => {
    if (url === CAREER_PAGE_URL) return native.current
    if (url === 'https://careers.cdac.in/' || url === 'https://careers.cdac.in') throw new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE (captured current strict-TLS access failure)')
    const row = [...native.ads, ...native.details].find(row => row.url === url)
    assert.ok(row, url)
    return corrupt === url ? '<main>Role criteria unavailable</main>' : row.body
  },
  fetchBinary: async url => Buffer.from(native.ads.find(row => row.url === url)?.body || assert.fail(url), 'base64'),
  now: () => new Date('2026-11-02T18:00:00Z'),
})

test('C-DAC active announcement discovery omits HTML comments and retains the official current portal handoff without a query id', () => {
  const rows = extractSearchResults(native.current)
  assert.equal(rows.length, 13)
  assert.ok(rows.some(row => /^https:\/\/careers\.cdac\.in\/?$/.test(row.applyUrl)))
  assert.equal(rows.some(row => row.applyUrl.includes('ca_cdac_chennai_recruitment_2026') || row.applyUrl.includes('CORRIGENDUM-Consultant.pdf')), false)
  assert.ok(rows.every(row => row.jobDescription == null))
})

test('C-DAC hydrates 49 individual native CAE role criteria, excludes expired and administrative records, and preserves unresolved scopes', async () => {
  const jobs = await createCdacScraper().run(replay())
  assert.equal(jobs.length, 49)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 49)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.jobDescription.length > 1000))
  assert.ok(jobs.some(job => /Quantum Computing/.test(job.title) && /Shor/.test(job.jobDescription)))
  assert.equal(jobs.filter(job => job.sourceUrl.includes('ca_TvmCDACAdjunctEngineer0825')).length, 3)
  const conflictingCount = jobs.find(job => job.sourceUrl.includes('job_CAE-TF'))
  assert.equal(conflictingCount.numberOfOpenings, null)
  assert.deepEqual(conflictingCount.sourceNativeVacancyCounts, { listing: 2, detailed: 1, conflicting: true })
  const evidence = jobs[0].nativeCollectionEvidence
  assert.equal(evidence.closedAdvertisements.length, 5)
  assert.equal(evidence.administrativeRecords.length, 5)
  assert.equal(evidence.closedAdvertisements.filter(row => row.pdf).length, 3)
  assert.ok(evidence.closedAdvertisements.filter(row => row.pdf).every(row => row.pdf.sha256.length === 64 && row.pdf.pages > 0 && row.pdf.textLength > 5000))
  assert.ok(evidence.gaps.some(row => /country/i.test(row.reason) && row.url.includes('ADS_2020')))
  assert.ok(evidence.gaps.some(row => row.url.startsWith('https://careers.cdac.in')))
  assert.equal(evidence.closingStable, true)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('C-DAC withholds an unavailable native detail rather than publishing the generic announcement or a criteria substitute', async () => {
  const jobs = await createCdacScraper().run(replay({ corrupt: native.details[0].url }))
  assert.equal(jobs.length, 48)
  assert.ok(jobs[0].nativeCollectionEvidence.gaps.some(row => row.url === native.details[0].url))
})
