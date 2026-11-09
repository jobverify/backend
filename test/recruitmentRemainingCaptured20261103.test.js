import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'

const directory = new URL('./test-data/recruitmentRemaining20261103/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)))
const catalog = new Map(getScraperCatalog().map(provider => [provider.source, provider]))
const sha = value => createHash('sha256').update(value).digest('hex')
const key = (url, init = {}) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')

for (const source of manifest.sources) test(`${source.source}: real public company/native-response replay preserves India job content`, async t => {
  let uncontrolled = 0
  t.mock.method(globalThis, 'fetch', () => { uncontrolled++; throw new Error('Uncontrolled HTTP is forbidden') })
  const requests = new Map(source.requests.map(receipt => [key(receipt.requestedURL, { method: receipt.method, body: receipt.requestBody }), receipt]))
  const calls = [], unexpected = []
  const jobs = await createCatalogScraper(catalog.get(source.source)).run({
    now: () => source.observedAt, sourceTimeoutMs: 45000, maxRequests: 40, maxPages: 8, maxDetails: 16,
    fetchImpl: async (url, init) => {
      const identity = key(url, init), receipt = requests.get(identity)
      calls.push(identity)
      if (!receipt) { unexpected.push(identity); throw new Error('Missing captured response for ' + identity) }
      const body = gunzipSync(readFileSync(new URL(receipt.filename, directory)))
      assert.equal(sha(body), receipt.bodySHA256)
      const response = new Response(body, { status: receipt.status, headers: { 'content-type': receipt.contentType } })
      Object.defineProperty(response, 'url', { value: receipt.finalURL })
      return response
    },
  })
  assert.equal(uncontrolled, 0)
  assert.deepEqual(unexpected, [])
  assert.equal(jobs.length, source.indiaJobs)
  const observed = jobs[RECRUITMENT_OBSERVATIONS]
  assert.equal(observed.nativeRecords, source.nativeRecords)
  assert.equal(observed.requestCount, source.requests.length)
  assert.equal(calls.length, source.requests.length)
  assert.deepEqual(observed.receipts.map(receipt => receipt.bodySHA256), source.requests.map(receipt => receipt.bodySHA256))
  assert.ok(observed.boards.every(board => board.bindingEvidence.verified && board.bindingEvidence.officialURL))
  if (catalog.get(source.source).requireCorporateIdentityMatch) assert.ok(observed.corporateIdentityEvidence.length)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.deepEqual(jobs.map(job => ({ jobId: String(job.jobId || job.id || job.applyUrl), title: job.title,
    applyUrl: job.applyUrl, postingDate: job.postingDate ?? null,
    nativeHiringOrganization: job.nativeHiringOrganization ?? null, descriptionSHA256: sha(job.sourceDescription),
  })), source.expectedJobs)
  assert.equal(new Set(jobs.map(job => job.jobId || job.id || job.applyUrl)).size, jobs.length)
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited ?? false, false)
  }
})
