import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-pagination-provider-responses-20261112.json.gz', import.meta.url))))
const replay = async (t, source, mutate) => {
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const row = fixture.responses.find(record => record.requestedUrl === String(url)
      && record.method === (options.method || 'GET') && record.requestBody === (options.body ?? null))
    assert.ok(row, 'Only captured public listing and detail requests may be read: ' + url)
    assert.equal(row.status, 200)
    const payload = JSON.parse(row.body)
    mutate?.(payload, String(url))
    return Response.json(payload)
  })
  return buildScrapers().find(scraper => scraper.name === source).run()
}

for (const [source, expectedIndia, expectedTotal, expectedCandidates = expectedIndia, expectedComplete = false] of [
  ['tenstorrent', 4, 122],
  ['razorpay', 23, 26, 26],
  ['databricks', 88, 913, 89],
  ['mongodb', 74, 381],
  ['stripe', 43, 787],
  ['freshworks', 31, 121, 31, true],
]) test('registered ' + source + ' reconciles the captured native total with its actual pagination contract', async t => {
  const jobs = await replay(t, source)
  assert.equal(jobs.length, expectedCandidates)
  assert.equal(analyzePublishableJobs(jobs).indiaJobs.length, expectedIndia)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.reportedTotal, expectedTotal)
  assert.equal(inventory.status, expectedComplete ? 'complete-inventory' : 'discovery-only')
  assert.doesNotMatch(inventory.reason, /configured-continuation-unavailable|upstream-count-mismatch/)
  assert.equal(extractionDetailHealth(jobs).complete, expectedComplete)
})

test('a Greenhouse response shorter than its native total remains incomplete', async t => {
  const jobs = await replay(t, 'tenstorrent', payload => {payload.jobs.pop()})
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.match(readInventoryEvidence(jobs).reason, /upstream-count-mismatch/)
})

test('a missing native Greenhouse total remains unknown rather than complete', async t => {
  const jobs = await replay(t, 'tenstorrent', payload => {delete payload.meta.total})
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('Freshworks retains an incomplete inventory when its second native page is short', async t => {
  const jobs = await replay(t, 'freshworks', (payload, url) => {
    if (url.includes('offset=100')) payload.content.pop()
  })
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})


test('Freshworks selects native India countries and keeps the global count separate', async t => {
  const jobs = await replay(t, 'freshworks')
  assert.equal(jobs.length, 31)
  assert.ok(jobs.every(job => job.country === 'in'))
  assert.ok(jobs.some(job => job.jobId === '744000160816709'))
  assert.ok(jobs.every(job => job.jobId !== '744000161179969'))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 121)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 31)
})

for (const country of [undefined, 'Global']) test('Freshworks keeps missing or unrecognized native country scope incomplete: ' + country, async t => {
  const id = '744000160816709'
  const jobs = await replay(t, 'freshworks', payload => {
    const rows = Array.isArray(payload.content) ? payload.content : [payload]
    for (const row of rows) if (row.id === id) {
      if (country === undefined) delete row.location.country
      else row.location.country = country
    }
  })
  assert.ok(jobs.every(job => job.jobId !== id))
  assert.equal(jobs.length, 30)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'discovery-only')
  assert.equal(inventory.indiaFacetCount, null)
  assert.match(inventory.reason, /native-location-scope-unresolved/)
})

for (const [id, detailCountry] of [['744000160816709', 'us'], ['744000161179969', 'in']]) test('Freshworks rejects conflicting listing/detail countries for ' + id, async t => {
  const jobs = await replay(t, 'freshworks', (payload, url) => {
    if (url.endsWith('/' + id)) payload.location.country = detailCountry
  })
  assert.ok(jobs.every(job => job.jobId !== id))
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'discovery-only')
  assert.equal(inventory.indiaFacetCount, null)
  assert.match(inventory.reason, /native-location-country-conflict/)
})
