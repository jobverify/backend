import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../scraper-support/runner.js'

const INDIA = { descriptor: 'India', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'IN' }
const cases = [
  { source: 'biogen', directory: 'biogen.workday', company: 'Biogen', total: 275, unresolved: 10, ids: ['REQ23930', 'REQ23928'] },
  { source: 'covestro', directory: 'covestro.workday', company: 'Covestro', total: 175, unresolved: 1, ids: [] },
  { source: 'constellationbrands', directory: 'constellationbrands.workday', company: 'Constellation Brands', total: 82, unresolved: 10, ids: [] },
]

for (const spec of cases) {
  const folder = new URL(`../scraper/${spec.directory}/fixtures/current-20261029/`, import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
  const receipts = manifest.requests.map(row => {
    const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
    assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
    return { ...row, body }
  })
  const details = receipts.filter(row => row.url.includes('/wday/cxs/') && row.url.includes('/job/'))
  const selected = details.find(row => JSON.parse(row.body).jobPostingInfo?.country)
  assert.ok(selected, 'A real source-specific native country response is required')
  const native = JSON.parse(selected.body), info = native.jobPostingInfo
  const options = { now: () => manifest.capturedAt, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    detailEnrichmentBudgetMs: 30000, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 } }
  const run = (overrides = {}) => createCatalogScraper(getScraperCatalog().find(row => row.source === spec.source)).run({ ...options, ...overrides })
  const jsonBody = (row, edit) => {
    const payload = JSON.parse(row.body)
    edit(payload)
    return { ...row, body: Buffer.from(JSON.stringify(payload)) }
  }
  // A geography-only mutation of a real foreign requisition exercises future
  // India extraction. It is never counted as a current live India vacancy.
  const withIndia = row => row.method === 'POST' ? jsonBody(row, payload => {
    for (const role of payload.jobPostings) if (role.bulletFields?.includes(info.jobReqId)) role.locationsText = 'Bengaluru, India'
  }) : row.url === selected.url ? jsonBody(row, payload => {
    Object.assign(payload.jobPostingInfo, { location: 'Bengaluru, India', country: INDIA, additionalLocations: [],
      jobRequisitionLocation: { descriptor: 'Bengaluru, India', country: INDIA } })
  }) : row
  const replay = (t, edit) => {
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
      assert.ok(queue?.length, 'Live requests are forbidden; missing real captured HTTP response: ' + key)
      const row = queue.length > 1 ? queue.shift() : queue[0]
      reads.push({ url, method, requestBody })
      const current = edit ? edit({ ...row, body: Buffer.from(row.body) }) : row
      const response = new Response(current.body, { status: current.status, headers: current.headers })
      Object.defineProperty(response, 'url', { value: current.finalURL })
      return response
    })
    return reads
  }

  test(`registered ${spec.source} reconciles its real native inventory and preserves incomplete company coverage`, async t => {
    const reads = replay(t), jobs = await run()
    assert.deepEqual(jobs.map(job => job.jobId), spec.ids)
    const proof = jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
    assert.ok(proof?.boards?.length, 'An empty sentinel response cannot prove native extraction')
    assert.equal(proof.completeSourceScope, false)
    assert.equal(proof.boards.length, 1)
    const board = proof.boards[0]
    assert.equal(board.reportedTotal, spec.total)
    assert.equal(board.scope, 'global-unfiltered')
    assert.deepEqual(board.appliedFacets, {})
    assert.equal(board.observedIndia, spec.ids.length)
    assert.equal(board.countryScopeComplete, false)
    assert.equal(board.unresolvedCountryRoles.length, spec.unresolved)
    assert.equal(board.reconciliation.initial.count, spec.total)
    assert.equal(board.reconciliation.closing.count, spec.total)
    assert.equal(board.reconciliation.initial.sha256, board.reconciliation.closing.sha256)
    assert.equal(board.explicitGlobalEmpty, false)
    for (const job of jobs) {
      const original = details.map(row => JSON.parse(row.body)).find(payload => payload.jobPostingInfo.jobReqId === job.jobId)
      assert.equal(job.sourceDescription, original.jobPostingInfo.jobDescription)
      assert.equal(job.postingDate, original.jobPostingInfo.startDate)
      assert.equal(job.postingDate, '2026-08-14')
      assert.equal(job.nativeEmployer, null)
      assert.equal(job.sourceUrl, original.jobPostingInfo.externalUrl)
      assert.equal(job.sourceDetailComplete, true)
      assert.equal(job.sourceScopeComplete, false)
      assert.equal(job.sourceListingComplete, false)
      assert.equal(job.lifecycleCleanupAllowed, false)
    }
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.firstParty, true)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    if (!jobs.length) assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
    assert.ok(reads.some(row => row.url === manifest.officialCareersUrl))
    const provider = getScraperCatalog().find(row => row.source === spec.source)
    assert.equal(provider.backfillMode, 'live-parser')
    assert.equal(provider.verifiedIndiaJobCount, null)
  })

  test(`${spec.source} extracts a future India role with full native content, original dates and unchanged employer evidence`, async t => {
    replay(t, withIndia)
    const jobs = await run(), job = jobs.find(row => row.jobId === info.jobReqId)
    assert.equal(jobs.length, spec.ids.length + 1)
    assert.ok(job)
    assert.equal(job.title, info.title)
    assert.equal(job.company, spec.company)
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDescription, info.jobDescription)
    assert.equal(job.sourceUrl, info.externalUrl)
    assert.equal(job.nativeEmployer, native.hiringOrganization.name.trim() || null)
    assert.equal(job.postingDate, info.startDate)
    assert.equal(job.nativeBoardProvenance[0].nativePostingUid, info.id)
    assert.equal(job.nativeBoardProvenance[0].requisitionId, info.jobReqId)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  })

  test(`${spec.source} rejects a removed current corporate handoff`, async t => {
    const reads = replay(t, row => row.url === manifest.officialCareersUrl
      ? { ...row, body: Buffer.from(row.body.toString().replaceAll('.myworkdayjobs.com', '.retired.invalid')) } : row)
    await assert.rejects(run(), /handoff|scope|board/i)
    assert.ok(reads.every(row => row.url === manifest.officialCareersUrl))
  })

  test(`${spec.source} rejects a blocked corporate page`, async t => {
    replay(t, row => row.url === manifest.officialCareersUrl ? { ...row, status: 403, body: Buffer.from('Denied') } : row)
    await assert.rejects(run(), /HTTP 403|handoff|scope|career/i)
  })

  for (const [label, change, pattern] of [
    ['contradictory native country', payload => { payload.jobPostingInfo.country = { ...INDIA, alpha2Code: 'US' } }, /scope|country/i],
    ['different native board', payload => { payload.jobPostingInfo.jobPostingSiteId = 'UnadvertisedBoard' }, /scope|identity|board/i],
    ['unrelated native employer', payload => { payload.hiringOrganization.name = 'Unrelated Recruiting Company' }, /employer/i],
    ['missing native description', payload => { payload.jobPostingInfo.jobDescription = '' }, /detail|description|inventory|requisition/i],
    ['closed native application', payload => { payload.jobPostingInfo.canApply = false }, /application|detail|inventory/i],
  ]) test(`${spec.source} rejects ${label}`, async t => {
    replay(t, row => {
      row = withIndia(row)
      return row.url === selected.url ? jsonBody(row, change) : row
    })
    await assert.rejects(run(), pattern)
  })

  test(`${spec.source} rejects changed closing inventory`, async t => {
    let firstPages = 0
    replay(t, row => {
      if (row.method !== 'POST' || JSON.parse(row.requestBody).offset !== 0 || ++firstPages !== 2) return row
      return jsonBody(row, payload => { payload.jobPostings[0].title = 'Changed during native collection' })
    })
    await assert.rejects(run(), /closing.*(?:identity|changed)/i)
  })

  test(`${spec.source} honors cancellation before network activity`, async t => {
    t.mock.method(globalThis, 'fetch', async () => assert.fail('A cancelled source must not fetch'))
    const controller = new AbortController()
    controller.abort(Error('Cancelled native source'))
    await assert.rejects(run({ signal: controller.signal }), /Cancelled native source/)
  })
}
