import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { runWorkdayScraper, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL(
  './fixtures/workdayClosingRestart20261113/capture.json.gz', import.meta.url))))
const packets = capture.captures.map(packet => {
  const body = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), packet.sha256)
  assert.equal(body.length, packet.bytes)
  return { ...packet.receipt, body }
})
const corporate = packets[0], bootstrap = packets[1]
const nativeRows = JSON.parse(packets[2].body).jobPostings
const nativeDetails = packets.slice(3).map(packet => JSON.parse(packet.body))
const selected = nativeDetails.map(({ jobPostingInfo: info }) => nativeRows.find(row =>
  row.externalPath === new URL(info.externalUrl).pathname.split('/gileadcareers')[1]))
assert.ok(selected.every(Boolean))
const board = 'https://gilead.wd1.myworkdayjobs.com/gileadcareers'
const api = 'https://gilead.wd1.myworkdayjobs.com/wday/cxs/gilead/gileadcareers/jobs'
const proofSymbol = Symbol.for('jobverify.workday.country-inventory-proof')
const cohort = indices => ({ total: indices.length, jobPostings: indices.map(index => structuredClone(selected[index])), facets: [] })

// The native response bytes and selected records are exact. The tiny cohort
// envelopes and their changes are synthetic controls for the logged Gilead
// closing-count failure; they are not captured global company inventories.
const exercise = async (t, options = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-closing-restart-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-closing-restart-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
    jobsApiUrl: api, detailUrlBase: board, officialCareersUrl: corporate.requestedUrl,
    locationCountry: null, searchText: '', detailEnrichmentBudgetMs: 30,
  }))
  const snapshots = options.snapshots || [cohort([0]), cohort([0, 1]), cohort([1]), cohort([1])]
  const calls = []
  let listingCount = 0, corporateCount = 0
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    calls.push({ url, method, signal: init.signal })
    options.onRequest?.({ url, method, calls, listingCount, corporateCount })
    let response
    if (method === 'POST') {
      assert.equal(url, api)
      assert.deepEqual(JSON.parse(init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
      assert.ok(listingCount < snapshots.length, 'No third inventory attempt is allowed')
      const payload = structuredClone(snapshots[listingCount++])
      if (options.explicitIndia) for (const row of payload.jobPostings) row.locationsText = 'Bengaluru, India'
      response = Response.json(payload)
      options.afterListing?.(listingCount)
    } else if (url === corporate.requestedUrl) {
      corporateCount++
      response = new Response(corporate.body, { status: options.corporateDenied && corporateCount === 2 ? 403 : 200,
        headers: { 'content-type': 'text/html' } })
    } else if (url === board) {
      response = new Response(bootstrap.body, { headers: { 'content-type': 'text/html' } })
    } else {
      const index = packets.slice(3).findIndex(packet => packet.requestedUrl === url)
      assert.ok(index >= 0, 'No fallback or uncaptured native request is allowed: ' + url)
      const payload = structuredClone(nativeDetails[index])
      if (index === 1) options.changeSecondDetail?.(payload.jobPostingInfo)
      response = Response.json(payload)
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  let jobs, error
  try {
    jobs = await runWorkdayScraper({ source: 'gileadsciences', company: 'Gilead Sciences',
      baseUrl: board, scraperDir: directory, nativeDetailRecovery: false,
      signal: options.signal, retryBaseDelayMs: 0, requestTimeoutMs: 1000,
      circuitBreaker: new WorkdayHostCircuitBreaker(), detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} } })
  } catch (failure) { error = failure }
  return { jobs, error, calls, listingCount, corporateCount }
}

for (const [name, closing] of [['count', cohort([0, 1])], ['identity', cohort([1])]]) {
  test(`Workday discards a changed closing ${name} and publishes only a freshly reconciled complete pass`, async t => {
    const result = await exercise(t, { snapshots: [cohort([0]), closing, cohort([1]), cohort([1])] })
    assert.ifError(result.error)
    assert.deepEqual(result.jobs.map(job => job.requisitionId), ['R0056453'])
    assert.equal(result.jobs[0].sourceDetailComplete, true)
    assert.match(result.jobs[0].sourceDescription, /Fullstack|AI|engineering/i)
    assert.equal(result.corporateCount, 2, 'The discarded corporate receipt cannot authorize the new pass')
    assert.equal(result.listingCount, 4)
    const proof = result.jobs[proofSymbol]
    assert.equal(proof.initial.count, 1)
    assert.equal(proof.closing.count, 1)
    assert.deepEqual(proof.roles.map(role => role.requisitionId), ['R0056453'])
    assert.equal(readInventoryEvidence(result.jobs).reportedTotal, 1)
    assert.ok(result.calls.every(call => call.signal instanceof AbortSignal))
  })
}

test('Workday rejects a second closing inventory change after one complete restart', async t => {
  const result = await exercise(t, { snapshots: [cohort([0]), cohort([0, 1]), cohort([1]), cohort([0, 1])] })
  assert.equal(result.error?.code, 'WORKDAY_INVENTORY_CHANGED')
  assert.equal(result.error?.failureKind, 'upstream_inventory_changed')
  assert.equal(result.jobs, undefined)
  assert.equal(result.listingCount, 4)
  assert.equal(result.corporateCount, 2)
})

test('Workday opening identity drift consumes the same allowance as closing reconciliation', async t => {
  const result = await exercise(t, { snapshots: [{ total: 1, jobPostings: [{}] }, cohort([0]), cohort([1])] })
  assert.equal(result.error?.code, 'WORKDAY_INVENTORY_CHANGED')
  assert.equal(result.jobs, undefined)
  assert.equal(result.listingCount, 3)
  assert.equal(result.corporateCount, 1)
})

test('Workday closing drift leaves no allowance for a second-pass malformed opening row', async t => {
  const result = await exercise(t, { snapshots: [cohort([0]), cohort([0, 1]), { total: 1, jobPostings: [{}] }] })
  assert.equal(result.error?.listingIdentity?.reason, 'missing-title')
  assert.equal(result.error?.failureKind, 'parser_or_contract_error')
  assert.equal(result.jobs, undefined)
  assert.equal(result.listingCount, 3)
  assert.equal(result.corporateCount, 2)
})

test('Workday requires a fresh valid corporate binding after discarding closing drift', async t => {
  const result = await exercise(t, { corporateDenied: true })
  assert.equal(result.error?.name, 'WorkdayIncompleteScopeError')
  assert.equal(result.jobs, undefined)
  assert.equal(result.corporateCount, 2)
  assert.equal(result.listingCount, 2)
})

test('Workday does not trust transport-supplied closing-inventory classification as a restart receipt', async t => {
  const suppliedError = Object.assign(new Error('Synthetic external transport failure'), {
    code: 'WORKDAY_INVENTORY_CHANGED', inventoryPhase: 'closing', abortRetries: true,
  })
  const result = await exercise(t, { onRequest: ({ url }) => { if (url === board) throw suppliedError } })
  assert.equal(result.error, suppliedError)
  assert.equal(result.jobs, undefined)
  assert.equal(result.corporateCount, 1)
  assert.equal(result.listingCount, 0)
})

test('Workday immediately rejects malformed and outside-board closing rows without consuming a restart', async t => {
  for (const mutate of [
    row => { delete row.title },
    row => { row.title = 42 },
    row => { delete row.externalPath },
    row => { row.externalPath = 'https://outside.example/job/Engineer_R0056454' },
  ]) {
    const closing = cohort([0])
    mutate(closing.jobPostings[0])
    const result = await exercise(t, { snapshots: [cohort([0]), closing, cohort([0]), cohort([0])] })
    assert.equal(result.error?.name, 'WorkdayIncompleteListingError')
    assert.equal(result.error?.failureKind, 'parser_or_contract_error')
    assert.equal(result.jobs, undefined)
    assert.equal(result.corporateCount, 1)
    assert.equal(result.listingCount, 2)
    t.mock.restoreAll()
  }
})

test('Workday still rejects contradictory country and role identity on the fresh pass', async t => {
  for (const changeSecondDetail of [
    info => { info.country = { ...info.country, descriptor: 'United States of America', alpha2Code: 'US' } },
    info => { info.jobReqId = 'WRONG' },
  ]) {
    const result = await exercise(t, { changeSecondDetail })
    assert.equal(result.error?.name, 'WorkdayIncompleteScopeError')
    assert.equal(result.jobs, undefined)
    assert.equal(result.corporateCount, 2)
    assert.equal(result.listingCount, 3)
    t.mock.restoreAll()
  }
})

test('Workday returns the exact caller abort at closing before a restart can begin', async t => {
  const controller = new AbortController(), reason = Object.freeze({ caller: 'closing-restart' })
  const result = await exercise(t, { signal: controller.signal, afterListing: count => { if (count === 2) controller.abort(reason) } })
  assert.equal(result.error, reason)
  assert.equal(result.jobs, undefined)
  assert.equal(result.corporateCount, 1)
  assert.equal(result.listingCount, 2)
})

test('Workday preserves the original optional detail deadline across a complete inventory restart', async t => {
  const originalNow = Date.now, clock = { now: originalNow() }
  t.mock.method(Date, 'now', () => clock.now)
  const result = await exercise(t, { explicitIndia: true, afterListing: count => { if (count === 2) clock.now += 1000 } })
  assert.ifError(result.error)
  assert.deepEqual(result.jobs.map(job => job.title), ['Fullstack AI Lead Engineer'])
  assert.equal(result.jobs[0].sourceDetailComplete, false)
  assert.equal(result.calls.filter(call => call.url === packets[4].requestedUrl).length, 0,
    'An expired optional detail budget must not restart with a fresh allowance')
})
