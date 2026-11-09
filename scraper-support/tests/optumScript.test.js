import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as optum from '../../scraper/optum/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const recorded = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/optum/test-data/native-current-20261107.json.gz', import.meta.url))))

test('Optum preserves its public helper entrypoints and current explicit brand listing contract', () => {
  assert.equal(optum.COMPANY_NAME, 'Optum')
  assert.equal(optum.SOURCE, 'optum')
  assert.equal(optum.ATS_PLATFORM, 'talentbrew-radancy+oracle-taleo')
  assert.equal(optum.CAREER_PAGE_URL, 'https://careers.unitedhealthgroup.com/location/india-jobs/34088/1269750/2')
  assert.equal(optum.buildSearchUrl(), optum.CAREER_PAGE_URL)
  assert.equal(optum.buildSearchUrl({ page: 2 }), 'https://careers.unitedhealthgroup.com/location/india-jobs/34088/1269750/2/2')
  const rows = optum.extractSearchResults(recorded.listings[0].body)
  assert.equal(rows.length, 15)
  assert.equal(rows[0].jobId, '102958124464')
  assert.equal(rows[0].requisitionId, '2396958')
  assert.equal(rows[0].nativeBrand, 'Optum')
  assert.equal(rows[0].country, null)
  assert.deepEqual(optum.extractPaginationSummary(recorded.listings[0].body), {
    hasNext: true, currentPage: 1, totalPages: 14, totalJobCount: 202, pageSize: 15,
    nextUrl: 'https://careers.unitedhealthgroup.com/location/india-jobs/34088/1269750/2/2',
  })
})

test('Optum preserves the native Taleo application and formal requisition without visiting the application', () => {
  const listing = optum.extractSearchResults(recorded.listings[0].body)[0]
  const role = optum.extractJobDetail(recorded.detail.body, listing)
  assert.equal(role.applyUrl, 'https://uhg.taleo.net/careersection/10780/jobapply.ftl?job=2396958')
  assert.equal(role.requisitionId, '2396958')
  assert.equal(role.company, 'Optum')
  assert.equal(role.nativeEmployer, 'UnitedHealth Group')
  assert.equal(role.applicationVisited, false)
  assert.equal(role.sourceDescription, recorded.nativeModel.description)
  assert.equal(role.postingDate, '2026-11-06')
})

test('Optum legacy body transport remains supported for recorded fixtures while inventory stays partial', async () => {
  const jobs = await optum.createOptumScraper({ maxPages: 1, maxJobs: 1 }).run({
    fetchText: async url => {
      if (url === recorded.listings[0].requestUrl) return recorded.listings[0].body
      if (url === recorded.detail.requestUrl) return recorded.detail.body
      throw new Error('Unrecorded fixture URL ' + url)
    },
    now: () => '2026-11-07T13:08:57.000Z',
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'optum')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
