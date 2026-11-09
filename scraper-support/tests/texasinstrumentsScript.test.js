import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractSearchResults,
  run,
} from '../../scraper/texasinstruments/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'texasinstruments',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps TI searches on its public Oracle Cloud finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://edbz.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10, location: 'Bengaluru, India' }),
    'https://edbz.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=10,offset=20,location=Bengaluru, India',
  )
})

test('buildJobDetailUrl keeps TI detail links on its public Oracle Cloud careers route', () => {
  assert.equal(
    buildJobDetailUrl('25003421'),
    'https://edbz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/25003421/',
  )
})

test('extractSearchResults normalizes TI Oracle Cloud requisitions and keeps only India jobs', () => {
  const jobs = extractSearchResults(readJsonFixture('search-results.json'))

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Applications Engineer',
    company: 'Texas Instruments',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '25003421',
    requisitionId: '25003421',
    sourceUrl: 'https://edbz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/25003421/',
    applyUrl: 'https://edbz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/25003421/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: "Bachelor's degree in Electrical Engineering",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    sourcePostingDateIsExact: false,
    closingDate: null,
    jobDescription: 'Develop customer-focused analog and embedded solutions. Collaborate with customers and field teams to solve technical problems.',
  })
})

for (const mismatch of [false, true]) test('run hydrates TI descriptions from the exact native Oracle requisition; mismatch=' + mismatch, async () => {
  const listing = readJsonFixture('search-results.json')
  const native = listing.items[0].requisitionList[0]
  native.ShortDescriptionStr = null
  native.ExternalResponsibilitiesStr = null
  const description = '<p>Design and verify native analog semiconductor systems.</p>'
  const jobs = await run({ maxJobs: 1, fetchJson: async (url, { signal, includeResponseMetadata }) => {
    if (url.includes('recruitingCEJobRequisitions?')) return listing
    assert.ok(signal)
    assert.equal(includeResponseMetadata, true)
    assert.match(url, /recruitingCEJobRequisitionDetails\?expand=all/)
    assert.match(url, /Id=%2225003421%22,siteNumber=CX/)
    return { status: 200, url, payload: { items: [{ Id: mismatch ? 'other-role' : native.Id,
      Title: native.Title, PrimaryLocationCountry: 'IN', ExternalDescriptionStr: description }] } }
  } })
  assert.equal(jobs[0].sourceDetailComplete, !mismatch)
  assert.equal(jobs[0].jobDescription, mismatch ? null : description)
})

for (const [name, listingDate, expected] of [
  ['calendar day agrees with native timestamp', '2026-10-29', true],
  ['different calendar day', '2026-10-28', false],
  ['conflicting exact timestamp', '2026-10-29T06:16:03+00:00', false],
]) test('captured TI native details preserve date precision: ' + name, async () => {
  const sample = readJsonFixture('current-native-detail-20261029.json')
  const jobs = await run({ maxJobs: 1, fetchJson: async (url) => {
    if (url.includes('recruitingCEJobRequisitions?')) return { items: [{ TotalJobsCount: 1, Limit: 24,
      requisitionList: [{ ...sample.listing, PostedDate: listingDate }] }] }
    assert.equal(url, sample.url)
    return { status: 200, url, payload: { items: [sample.detail] } }
  } })
  assert.equal(jobs[0].sourceDetailComplete, expected)
  if (expected) {
    assert.match(jobs[0].sourceDescription, /About the Opportunity/)
    assert.equal(jobs[0].sourcePostingDateIsExact, false)
  } else assert.equal(jobs[0].jobDescription, null)
})
