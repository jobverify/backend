import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

const directory = new URL('./fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)))
const receipts = manifest.requests.map(row => ({ ...row, body: gunzipSync(readFileSync(new URL(row.filename, directory))) }))
const run = () => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'generalmills')).run({
  now: () => manifest.capturedAt, nativeRetryBaseDelayMs: 0, retryBaseDelayMs: 0, requestTimeoutMs: 2000,
  requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 },
})
const target = '/Manager---Marketing-Technology--Sites---Services_10131240-1'
function replay(t, status, failures) {
  const queues = new Map(), counts = new Map(), reads = []
  for (const row of receipts) {
    const key = JSON.stringify([row.method, row.url, row.requestBody])
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  let failed = 0
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), key = JSON.stringify([init.method || 'GET', url, init.body || null])
    const queue = queues.get(key)
    assert.ok(queue?.length, 'Uncaptured native request: ' + key)
    const count = (counts.get(key) || 0) + 1
    counts.set(key, count); reads.push(url)
    // Target a full closing role read after enumeration, not an engine request.
    const candidate = url.includes('/wday/cxs/') && url.endsWith(target)
    if (candidate && count >= 2 && failed < failures) {
      failed++
      const response = new Response(status === 200 ? '{"errors":["native unavailable"]}' : 'Upstream unavailable', {
        status, headers: { 'content-type': status === 200 ? 'application/json' : 'text/plain' },
      })
      Object.defineProperty(response, 'url', { value: url }); return response
    }
    const row = queue.length > 1 ? queue.shift() : queue[0]
    const response = new Response(row.body, { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.finalURL }); return response
  })
  return { reads, failed: () => failed }
}

test('General Mills recovers one transient closing HTTP502 without restarting its validated enumeration', async t => {
  const audit = replay(t, 502, 1)
  const jobs = await run()
  assert.equal(jobs.length, 156)
  assert.equal(audit.failed(), 1)
  assert.equal(audit.reads.filter(url => url === manifest.officialCareersUrl).length, 1)
  assert.ok(jobs.every(job => job.lifecycleCleanupAllowed === false && job.sourceScopeComplete === false))
})

test('General Mills bounds persistent closing HTTP502 recovery and preserves the native status', async t => {
  const audit = replay(t, 502, 20)
  await assert.rejects(run(), error => (error.status ?? error.cause?.status) === 502)
  assert.equal(audit.failed(), 3)
})

test('General Mills stops a closing HTTP403 after its first denial', async t => {
  const audit = replay(t, 403, 20)
  await assert.rejects(run(), error => (error.status ?? error.cause?.status) === 403 && error.abortRetries === true)
  assert.equal(audit.failed(), 1)
})

test('General Mills never restarts its validated source for a native error envelope', async t => {
  const audit = replay(t, 200, 20)
  await assert.rejects(withRetry(run, { attempts: 3, baseDelayMs: 0, label: 'generalmills-outer-contract-regression' }))
  assert.equal(audit.reads.filter(url => url === manifest.officialCareersUrl).length, 1)
  assert.equal(audit.failed(), 1)
})
