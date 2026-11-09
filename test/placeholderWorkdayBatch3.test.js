import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../scraper-support/runner.js'

const cases = [
  { source: 'dataminr', directory: 'dataminr', total: 24, unresolved: 1 },
  { source: 'darktrace', directory: 'darktrace', total: 73, unresolved: 11 },
  { source: 'gileadsciences', directory: 'gileadsciences.workday', total: 416, unresolved: 0, countryScopeComplete: true },
]

for (const spec of cases) {
  const folder = new URL(`../scraper/${spec.directory}/fixtures/current-20261029/`, import.meta.url)
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder), 'utf8'))
  const receipts = manifest.requests.map(row => {
    const body = gunzipSync(fs.readFileSync(new URL(row.filename, folder)))
    assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
    return { ...row, body }
  })
  const firstCountryRole = receipts.find(row => row.url.includes('/wday/cxs/') && row.url.includes('/job/')
    && JSON.parse(row.body).jobPostingInfo?.country)
  assert.ok(firstCountryRole, 'The capture must contain a complete native country detail response')
  const roleId = JSON.parse(firstCountryRole.body).jobPostingInfo.jobReqId
  const options = { now: () => manifest.capturedAt, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
    detailEnrichmentBudgetMs: 30000, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 } }
  const run = (overrides = {}) => createCatalogScraper(getScraperCatalog().find(row => row.source === spec.source)).run({ ...options, ...overrides })
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
      assert.ok(queue?.length, 'Live requests are forbidden; missing captured native response: ' + key)
      const row = queue.length > 1 ? queue.shift() : queue[0]
      reads.push({ url, method, requestBody })
      const current = edit ? edit({ ...row, body: Buffer.from(row.body) }) : row
      const response = new Response(current.body, { status: current.status, headers: current.headers })
      Object.defineProperty(response, 'url', { value: current.finalURL })
      return response
    })
    return reads
  }

  test(`registered ${spec.source} reads its complete native board and retains unresolved coverage even without India output`, async t => {
    const reads = replay(t)
    const jobs = await run()
    assert.deepEqual(jobs, [])
    const audit = jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
    assert.ok(audit?.boards?.length, 'A sentinel returning an empty array is not an implemented inventory check')
    assert.equal(audit.completeSourceScope, false)
    assert.equal(audit.boards.length, 1)
    const board = audit.boards[0]
    assert.equal(board.reportedTotal, spec.total)
    assert.equal(board.scope, 'global-unfiltered')
    assert.deepEqual(board.appliedFacets, {})
    assert.equal(board.observedIndia, 0)
    assert.equal(board.countryScopeComplete, spec.countryScopeComplete ?? false)
    assert.equal(board.unresolvedCountryRoles.length, spec.unresolved)
    assert.equal(board.reconciliation.initial.count, spec.total)
    assert.equal(board.reconciliation.initial.sha256, board.reconciliation.closing.sha256)
    assert.equal(board.reconciliation.closing.count, spec.total)
    assert.equal(board.explicitGlobalEmpty, false)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.firstParty, true)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
    assert.ok(reads.some(row => row.url === manifest.officialCareersUrl))
    if (spec.source === 'gileadsciences') {
      const native = receipts.find(row => row.url.includes('/wday/cxs/') && row.url.includes('/job/')
        && JSON.parse(row.body).jobPostingInfo?.jobReqId === 'R0056267')
      const info = JSON.parse(native.body).jobPostingInfo
      assert.equal(info.country.descriptor, 'United States of America')
      assert.deepEqual(info.additionalLocations, ['United States - Texas - Austin'])
      assert.ok(reads.some(row => row.url === native.url))
      const requestKey = row => JSON.stringify([row.method, row.url, row.requestBody])
      assert.deepEqual(reads.map(requestKey).sort(), receipts.map(requestKey).sort(),
        'The entire retained listing/detail/closing receipt set must still be consumed')
    }
    assert.equal(getScraperCatalog().find(row => row.source === spec.source).backfillMode, 'live-parser')
  })

  if (spec.source === 'gileadsciences') test('gileadsciences retains unknown additional country scope without borrowing its foreign primary', async t => {
    const unresolvedLocation = 'Unresolved secondary campus'
    replay(t, row => {
      if (!row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
      const payload = JSON.parse(row.body)
      if (payload.jobPostingInfo.jobReqId !== 'R0056267') return row
      payload.jobPostingInfo.additionalLocations = [unresolvedLocation]
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    const jobs = await run()
    assert.deepEqual(jobs, [])
    const audit = jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
    assert.equal(audit.completeSourceScope, false)
    const board = audit.boards[0]
    assert.equal(board.countryScopeComplete, false)
    assert.equal(board.unresolvedCountryRoles.length, 1)
    assert.equal(board.unresolvedCountryRoles[0].requisitionId, 'R0056267')
    assert.ok(board.unresolvedCountryRoles[0].locations.includes(unresolvedLocation))
    assert.equal(board.reconciliation.initial.count, spec.total)
    assert.equal(board.reconciliation.closing.count, spec.total)
    assert.equal(board.reconciliation.initial.sha256, board.reconciliation.closing.sha256)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.notEqual(resolveZeroJobOutcome({ provider: {} }, jobs, []), 'fetched-zero')
  })

  test(`${spec.source} rejects a removed current corporate handoff`, async t => {
    const reads = replay(t, row => row.url === manifest.officialCareersUrl
      ? { ...row, body: Buffer.from(row.body.toString().replaceAll('.myworkdayjobs.com', '.retired.invalid')) } : row)
    await assert.rejects(run(), /handoff|scope|board/i)
    assert.ok(reads.every(row => row.url === manifest.officialCareersUrl))
  })

  for (const [label, change, pattern] of [
    ['conflicting native country', info => { info.country = { descriptor: 'India', alpha2Code: 'US' } }, /scope|country/i],
    ['different native board', info => { info.jobPostingSiteId = 'UnadvertisedBoard' }, /scope|identity/i],
  ]) test(`${spec.source} rejects ${label} before excluding a foreign role`, async t => {
    replay(t, row => {
      if (!row.url.includes('/wday/cxs/') || !row.url.includes('/job/')) return row
      const payload = JSON.parse(row.body)
      if (payload.jobPostingInfo.jobReqId !== roleId) return row
      change(payload.jobPostingInfo)
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
    })
    await assert.rejects(run(), pattern)
  })

  test(`${spec.source} rejects changed closing inventory`, async t => {
    let firstPages = 0
    replay(t, row => {
      if (row.method !== 'POST' || JSON.parse(row.requestBody).offset !== 0 || ++firstPages !== 2) return row
      const payload = JSON.parse(row.body)
      payload.jobPostings[0].title = 'Changed during native collection'
      return { ...row, body: Buffer.from(JSON.stringify(payload)) }
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
