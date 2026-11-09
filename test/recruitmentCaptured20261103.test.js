import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'

const directory = new URL('./test-data/recruitment20261103/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)))
const catalog = new Map(getScraperCatalog().map(provider => [provider.source, provider]))
const sha = body => createHash('sha256').update(body).digest('hex')
const key = (url, init = {}) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')

for (const source of manifest.sources) {
  test(`${source.source}: replay actual public corporate handoffs and native inventory from 2026-11-03`, async t => {
    let uncontrolled = 0
    t.mock.method(globalThis, 'fetch', () => { uncontrolled++; throw new Error('Uncontrolled HTTP is forbidden') })
    const requests = new Map(source.requests.map(receipt => [key(receipt.requestedURL, {
      method: receipt.method, body: receipt.requestBody,
    }), receipt]))
    const calls = [], unexpected = []
    const jobs = await createCatalogScraper(catalog.get(source.source)).run({
      now: () => source.observedAt, sourceTimeoutMs: 45000, maxRequests: 32, maxPages: 8, maxDetails: 12,
      fetchImpl: async (url, init) => {
        const identity = key(url, init), receipt = requests.get(identity)
        calls.push(identity)
        if (!receipt) { unexpected.push(identity); throw new Error('No captured response for ' + identity) }
        const body = gunzipSync(readFileSync(new URL(receipt.filename, directory)))
        assert.equal(sha(body), receipt.bodySHA256, 'Public capture integrity')
        const response = new Response(body, { status: receipt.status, headers: { 'content-type': receipt.contentType } })
        Object.defineProperty(response, 'url', { value: receipt.finalURL })
        return response
      },
    })
    assert.equal(uncontrolled, 0)
    assert.deepEqual(unexpected, [])
    assert.equal(jobs.length, source.indiaJobs)
    const observations = jobs[RECRUITMENT_OBSERVATIONS]
    assert.equal(observations.nativeRecords, source.nativeRecords)
    assert.equal(observations.requestCount, source.requests.length)
    assert.equal(calls.length, source.requests.length)
    assert.equal(observations.sourceScopeComplete, false)
    assert.equal(observations.lifecycleCleanupAllowed, false)
    assert.deepEqual(observations.receipts.map(receipt => receipt.bodySHA256), source.requests.map(receipt => receipt.bodySHA256))
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.notEqual(evidence.status, 'verified-empty')
    assert.deepEqual(jobs.map(job => ({ jobId: job.jobId, applyUrl: job.applyUrl, postingDate: job.postingDate,
      title: job.title, nativeHiringOrganization: job.nativeHiringOrganization,
      descriptionSHA256: sha(job.sourceDescription),
    })), source.expectedJobs)
    for (const job of jobs) {
      assert.equal(job.country, 'India')
      assert.equal(job.source, source.source)
      assert.equal(job.sourceScopeComplete, false)
      assert.equal(job.sourceListingComplete, false)
      assert.equal(job.lifecycleCleanupAllowed, false)
      assert.ok(job.nativeSourceRecord)
    }
  })
}
