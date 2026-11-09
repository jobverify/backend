import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { CAREERS_URL, run } from './script.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const folder = new URL('./fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
const receipts = manifest.requests.map(receipt => {
  const body = gunzipSync(fs.readFileSync(new URL(receipt.filename, folder)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return { ...receipt, body }
})
const nativeDetails = receipts.filter(receipt => receipt.url.includes('/wday/cxs/') && receipt.url.includes('/job/'))
  .map(receipt => JSON.parse(receipt.body).jobPostingInfo)
const plainKey = html => { const doc = document(html); return doc.text(doc.root).replace(/\s/g, '') }
const options = { retryBaseDelayMs: 0, requestTimeoutMs: 1000, detailEnrichmentBudgetMs: 5000 }
const mockFetch = (t, edit) => {
  const queues = new Map(), reads = []
  for (const receipt of receipts) {
    const key = `${receipt.method} ${receipt.url}`
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(receipt)
  }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url || input.href
    const method = (init.method || 'GET').toUpperCase(), key = `${method} ${url}`, available = queues.get(key)
    assert.ok(available?.length, `Uncaptured native request: ${key}`)
    const receipt = available.length > 1 ? available.shift() : available[0]
    reads.push({ url, method })
    if (method === 'POST') assert.deepEqual(JSON.parse(init.body), JSON.parse(receipt.requestBody))
    const current = edit ? edit({ ...receipt, body: Buffer.from(receipt.body) }, reads) : receipt
    const response = new Response(current.body, { status: current.status, headers: current.headers })
    Object.defineProperty(response, 'url', { value: current.finalURL })
    return response
  })
  return reads
}

test('registered Cengage source extracts all four native India-board roles with complete content and original dates', async t => {
  mockFetch(t)
  const provider = getScraperCatalog().find(provider => provider.source === 'cengage')
  assert.equal(provider.backfillMode, 'live-parser')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.verifiedIndiaJobCount, null)
  const jobs = await createCatalogScraper(provider).run(options)
  assert.deepEqual(jobs.map(job => job.jobId), ['R2026-827', 'R2026-244', 'R2026-1001', 'R2026-237'])
  for (const job of jobs) {
    const native = nativeDetails.find(detail => detail.jobReqId === job.jobId)
    assert.equal(native.country.descriptor, 'India')
    assert.equal(job.country, 'India')
    assert.equal(job.company, 'Cengage')
    assert.equal(job.postingDate, native.startDate)
    assert.equal(plainKey(job.sourceDescription), plainKey(native.jobDescription))
    assert.ok(job.sourceDescription.length > 3500)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceNativeBoardScope, 'CengageIndiaCareers')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(jobs[0].postingDate, '2026-10-20')
  assert.equal(jobs[1].postingDate, '2026-08-27')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('a removed current corporate handoff cannot authorize a historical Cengage tenant', async t => {
  const reads = mockFetch(t, receipt => receipt.url === CAREERS_URL
    ? { ...receipt, body: Buffer.from(receipt.body.toString().replaceAll('CengageIndiaCareers', 'DetachedHistoricalBoard')) } : receipt)
  await assert.rejects(run(options), /handoff|scope|board/i)
  assert.ok(reads.every(read => read.url === CAREERS_URL))
})

test('a native country contradiction cannot relabel a foreign role as an India vacancy', async t => {
  mockFetch(t, receipt => {
    if (!receipt.url.includes('/wday/cxs/') || !receipt.url.includes('/job/')) return receipt
    const payload = JSON.parse(receipt.body)
    payload.jobPostingInfo.country.descriptor = 'United States of America'
    return { ...receipt, body: Buffer.from(JSON.stringify(payload)) }
  })
  await assert.rejects(run(options), error => error.code === 'WORKDAY_NATIVE_COUNTRY_MISMATCH')
})

test('a changed closing native listing cannot authorize complete inventory or cleanup', async t => {
  let pages = 0
  mockFetch(t, receipt => {
    if (receipt.method !== 'POST' || ++pages !== 2) return receipt
    const payload = JSON.parse(receipt.body)
    payload.jobPostings[0].title = 'Changed during collection'
    return { ...receipt, body: Buffer.from(JSON.stringify(payload)) }
  })
  await assert.rejects(run(options), /closing.*identity|closing.*changed/i)
})

test('pre-cancelled Cengage collection makes no requests', async t => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Cancelled source must not fetch'))
  const controller = new AbortController()
  controller.abort(Error('cancel Cengage source'))
  await assert.rejects(run({ signal: controller.signal }), /cancel Cengage/)
})
