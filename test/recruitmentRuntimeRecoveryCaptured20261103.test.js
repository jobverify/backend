import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'
import {assertSpecializedBatchExtraction} from './helpers/replaySpecializedRecruitmentBatch.js'

const directory = new URL('./test-data/recruitmentRuntimeRecovery20261103/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)))
const catalog = new Map(getScraperCatalog().map(provider => [provider.source, provider]))
const sha = value => createHash('sha256').update(value).digest('hex')
const key = (url, init = {}) => (init.method || 'GET') + ':' + url + ':' + (init.body || '')

test('all original 13-source historical captures retain all465 exact response bytes and hashes',()=>{
  assert.equal(manifest.sources.length,13)
  let count=0
  for(const source of manifest.sources)for(const receipt of source.requests){const body=gunzipSync(readFileSync(new URL(receipt.filename,directory)));assert.equal(body.length,receipt.bodyBytes);assert.equal(sha(body),receipt.bodySHA256);count++}
  assert.equal(count,465)
  const historical=manifest.sources.find(s=>s.source==='evonik');assert.equal(historical.observedAt,'2026-11-03T12:46:50.546Z');assert.equal(historical.indiaJobs,3);assert.equal(historical.nativeRecords,30)
})

for (const source of manifest.sources) test(`${source.source}: recovered production route reproduces fresh public India postings`, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncontrolled HTTP is forbidden'))
  // This original cohort remains immutable historical public response evidence.
  // Evonik now uses its separately captured current typed country/native route.
  if(source.source==='evonik'){
    for(const receipt of source.requests){const original=gunzipSync(readFileSync(new URL(receipt.filename,directory)));assert.equal(original.length,receipt.bodyBytes);assert.equal(sha(original),receipt.bodySHA256)}
    return assertSpecializedBatchExtraction(t,catalog.get(source.source))
  }
  const requests = new Map(source.requests.map(row => [key(row.requestedURL, { method: row.method, body: row.requestBody }), row]))
  const calls = [], unexpected = []
  const jobs = await createCatalogScraper(catalog.get(source.source)).run({ now: () => source.observedAt,
    sourceTimeoutMs: 60000, ...source.limits,
    fetchImpl: async (url, init) => {
      const receipt = requests.get(key(url, init))
      if (!receipt) { unexpected.push(key(url, init)); throw Error('Missing public response capture') }
      const body = gunzipSync(readFileSync(new URL(receipt.filename, directory)))
      assert.equal(sha(body), receipt.bodySHA256)
      calls.push(receipt.bodySHA256)
      const response = new Response(body, { status: receipt.status, headers: { 'content-type': receipt.contentType } })
      Object.defineProperty(response, 'url', { value: receipt.finalURL })
      return response
    } })
  assert.deepEqual(unexpected, [])
  assert.deepEqual(calls, source.requests.map(row => row.bodySHA256))
  assert.equal(jobs.length, source.indiaJobs)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].nativeRecords, source.nativeRecords)
  assert.deepEqual(jobs.map(job => ({ jobId: String(job.jobId || job.id || job.applyUrl), title: job.title,
    applyUrl: job.applyUrl, postingDate: job.postingDate ?? null, nativeHiringOrganization: job.nativeHiringOrganization ?? null,
    descriptionSHA256: sha(job.sourceDescription) })), source.expectedJobs)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, jobs.length)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.notEqual(evidence.status, 'verified-empty')
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited ?? false, false)
    assert.ok(job.nativeHiringOrganization?.name)
  }
})
