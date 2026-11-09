import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const cases = [
  { source: 'generalmills', directory: 'generalmills.workday', company: 'General Mills',
    count: 156, firstId: '10131240', firstTitle: "Manager \u2013 Marketing Technology, Sites & Services", firstDate: "2026-10-29", boardCount: 1 },
]

for (const spec of cases) {
  const folder = new URL(`../scraper/${spec.directory}/fixtures/current-20261029/`, import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
  const receipts = manifest.requests.map(row => {
    const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
    assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
    return { ...row, body }
  })
  const options = { now: () => manifest.capturedAt, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    detailEnrichmentBudgetMs: 30000, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 } }
  const run = (overrides = {}) => createCatalogScraper(getScraperCatalog().find(row => row.source === spec.source)).run({ ...options, ...overrides })
  const nativeRole = jobId => receipts.filter(row => row.status === 200 && row.url.includes('/wday/cxs/') && row.url.includes('/job/'))
    .map(row => JSON.parse(row.body)).find(payload => payload.jobPostingInfo.jobReqId === jobId)
  const replay = (t, edit, extraResponses = new Map()) => {
    const queues = new Map(), reads = []
    for (const row of receipts) {
      const key = JSON.stringify([row.method, row.url, row.requestBody])
      if (!queues.has(key)) queues.set(key, [])
      queues.get(key).push(row)
    }
    t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.href || input.url
      const method = (init.method || 'GET').toUpperCase(), requestBody = init.body || null
      const key = JSON.stringify([method, url, requestBody]), queue = queues.get(key)
      assert.ok(queue?.length || extraResponses.has(key), 'Live requests are forbidden; missing complete captured response: ' + key)
      const row = queue?.length ? queue.length > 1 ? queue.shift() : queue[0] : extraResponses.get(key)
      reads.push({ url, method, requestBody })
      const current = edit ? edit({ ...row, body: Buffer.from(row.body) }, reads) : row
      const response = new Response(current.body, { status: current.status, headers: current.headers })
      Object.defineProperty(response, 'url', { value: current.finalURL })
      return response
    })
    return reads
  }

  test(`registered ${spec.source} replaces the sentinel with complete native India role content`, async t => {
    replay(t)
    const jobs = await run()
    assert.equal(jobs.length, spec.count)
    assert.equal(jobs.filter(job => job.nativeEmployer === null).length, 42)
    assert.equal(jobs[0].jobId, spec.firstId)
    assert.equal(jobs[0].title, spec.firstTitle)
    assert.equal(jobs[0].postingDate, spec.firstDate)
    for (const job of jobs) {
      const native = nativeRole(job.jobId)
      assert.ok(native, 'Each output must bind to a captured native requisition')
      assert.equal(job.company, spec.company)
      assert.equal(job.country, 'India')
      assert.equal(job.sourceDescription, native.jobPostingInfo.jobDescription)
      assert.equal(job.nativeEmployer, native.hiringOrganization.name.trim() || null)
      assert.equal(job.postingDate, native.jobPostingInfo.startDate)
      assert.ok(job.sourceDescription.length > 150)
      assert.equal(job.sourceDetailComplete, true)
      assert.equal(job.sourceScopeComplete, false)
      assert.equal(job.sourceListingComplete, false)
      assert.equal(job.lifecycleCleanupAllowed, false)
      assert.equal(job.sourceBoardInventories.length, spec.boardCount)
      assert.equal(job.nativeBoardProvenance[0].requisitionId, job.jobId)
    }
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
    assert.equal(getScraperCatalog().find(row => row.source === spec.source).backfillMode, 'live-parser')
  })

  test(`${spec.source} rejects a removed current corporate board handoff`, async t => {
    const reads = replay(t, row => row.url === manifest.officialCareersUrl
      ? { ...row, body: Buffer.from(row.body.toString().replaceAll('.myworkdayjobs.com', '.retired.invalid')) } : row)
    await assert.rejects(run(), /handoff|scope|board/i)
    assert.ok(reads.every(row => row.url === manifest.officialCareersUrl))
  })

  test(`${spec.source} rejects contradictory native country identities`, async t => {
    replay(t, row => {
      if (!row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
      const payload = JSON.parse(row.body)
      if (payload.jobPostingInfo.jobReqId !== spec.firstId) return row
      payload.jobPostingInfo.country.descriptor = 'United States of America'
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    await assert.rejects(run(), error => error.code === 'WORKDAY_NATIVE_COUNTRY_MISMATCH')
  })

  test(`${spec.source} rejects an unrelated native employer on the current board`, async t => {
    replay(t, row => {
      if (!row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
      const payload = JSON.parse(row.body)
      if (payload.jobPostingInfo.jobReqId !== spec.firstId) return row
      payload.hiringOrganization.name = 'Unrelated Recruiting Company'
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    await assert.rejects(run(), /employer/i)
  })

  test(`${spec.source} cannot publish generated or empty text in place of a native description`, async t => {
    replay(t, row => {
      if (!row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
      const payload = JSON.parse(row.body)
      if (payload.jobPostingInfo.jobReqId !== spec.firstId) return row
      payload.jobPostingInfo.jobDescription = ''
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    await assert.rejects(run())
  })

  for (const employer of [undefined, null, 42]) {
    test('General Mills permits a native blank employer but rejects ' + String(employer), async t => {
      replay(t, row => {
        if (row.status !== 200 || !row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
        const payload = JSON.parse(row.body)
        if (payload.jobPostingInfo.jobReqId !== spec.firstId) return row
        payload.hiringOrganization.name = employer
        return { ...row, body: Buffer.from(JSON.stringify(payload)) }
      })
      await assert.rejects(run(), /employer/i)
    })
  }

  test(`${spec.source} rejects a changed closing global inventory`, async t => {
    let firstPages = 0
    replay(t, row => {
      if (row.method !== 'POST' || JSON.parse(row.requestBody).offset !== 0 || ++firstPages !== 2) return row
      const payload = JSON.parse(row.body)
      payload.jobPostings[0].title = 'Changed during collection'
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    await assert.rejects(run(), /closing.*identity|closing.*changed/i)
  })

  test(`${spec.source} honors cancellation before network activity`, async t => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('A cancelled source must not fetch'))
    const controller = new AbortController()
    controller.abort(Error('Cancelled source integration'))
    await assert.rejects(run({ signal: controller.signal }), /Cancelled source integration/)
  })

}
