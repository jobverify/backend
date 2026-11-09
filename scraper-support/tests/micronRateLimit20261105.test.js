import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setTimeout as sleep, setImmediate as nextTurn } from 'node:timers/promises'
import test from 'node:test'
import { createMicronTechnologyIndiaScraper } from '../../scraper/microntechnologyindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../utils/extractionDetailHealth.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const pair = JSON.parse(gunzipSync(readFileSync(new URL(
  '../../scraper/microntechnologyindia/native-captures/2026-11-01-native-pair.json.gz', import.meta.url))))
const nativeListing = JSON.parse(pair.listingBody), nativeDetail = JSON.parse(pair.detailBody)
const nativeRow = nativeListing.data.positions.find(row => row.id === nativeDetail.data.id)
const official = '<title>Careers | Micron India</title><p>Micron Hyderabad India Search current jobs</p>'
  + '<a href="https://micron.eightfold.ai/careers?location=India&domain=micron.com">Search current jobs</a>'
const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const json = payload => new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } })
const limited = retryAfter => new Response(null, { status: 429, headers: { 'Retry-After': retryAfter } })

// One genuine captured role in a deliberately modeled count=1 inventory. Extra
// roles used by concurrency/capacity controls are synthetic, never native proof.
const controlRole = index => ({ ...structuredClone(nativeRow), id: 80000000 + index,
  displayJobId: 'CONTROL-' + index, name: 'Synthetic pacing control ' + index,
  positionUrl: '/careers/job/' + (80000000 + index) })
const detailFor = row => ({ ...structuredClone(nativeDetail), data: {
  ...structuredClone(nativeDetail.data), ...structuredClone(row),
  publicUrl: 'https://careers.micron.com' + row.positionUrl,
} })

const boundary = (t, { rows = [nativeRow], respond = () => json(nativeDetail), signal } = {}) => {
  const requests = [], details = [], closes = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const request = new URL(url)
    assert.equal(request.origin, 'https://careers.micron.com')
    assert.equal(request.pathname, '/api/pcsx/position_details')
    const row = rows.find(value => String(value.id) === request.searchParams.get('position_id'))
    assert.ok(row, 'The native request must retain the exact listed position ID')
    const event = { url: String(url), id: row.id, at: performance.now(), options }
    requests.push(event); details.push(event)
    return respond({ row, count: details.filter(value => value.id === row.id).length, event })
  })
  const scraper = createMicronTechnologyIndiaScraper({ createBrowserFetchSessionImpl: async () => ({
    fetchText: async url => {
      const request = new URL(url)
      assert.equal(request.origin, 'https://careers.micron.com')
      assert.equal(request.pathname, '/api/pcsx/search')
      assert.equal(request.searchParams.get('limit'), '10')
      requests.push({ url, at: performance.now() })
      return JSON.stringify({ status: 200, error: { message: '', body: '' },
        data: { positions: structuredClone(rows), count: rows.length } })
    },
    close: async () => { closes.push(performance.now()) },
  }) })
  return { run: () => scraper.run({ fetchText: async () => official, signal }), requests, details, closes }
}

const assertPartial = jobs => {
  const inventoryEvidence = readInventoryEvidence(jobs), detailHealth = extractionDetailHealth(jobs)
  assert.equal(inventoryEvidence.listingComplete, false)
  assert.equal(detailHealth.complete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence, detailHealth }), { replaceExisting: false })
}

test('Micron native HTTP 429 retries recover the exact full description and honor Retry-After', { timeout: 6000 }, async t => {
  const transport = boundary(t, { respond: ({ count }) => count === 1 ? limited('1.3') : json(nativeDetail) })
  const jobs = await transport.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 44649782)
  assert.equal(jobs[0].requisitionId, 'JR113413')
  assert.equal(jobs[0].jobDescription, nativeDetail.data.jobDescription)
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(transport.details.length, 2)
  assert.ok(transport.details[1].at - transport.details[0].at >= 1250, 'The 1.3-second native cooldown cannot be shortened')
  assert.equal(transport.closes.length, 1)
})

test('Micron native pacing spaces browser/listing and concurrent detail starts and shares the server cooldown', { timeout: 6000 }, async t => {
  const rows = [nativeRow, controlRole(1)]
  const transport = boundary(t, { rows, respond: ({ row, count }) => row.id === nativeRow.id && count === 1
    ? limited('1.3') : json(detailFor(row)) })
  const jobs = await transport.run()
  assert.equal(jobs.length, 2)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  for (let index = 1; index < transport.requests.length; index++) {
    assert.ok(transport.requests[index].at - transport.requests[index - 1].at >= 225, 'Paced starts must prevent the original six-worker request burst')
  }
  const first = transport.details[0]
  assert.ok(transport.details.slice(1).every(event => event.at - first.at >= 1250), 'Queued peers must observe the same native Retry-After')
})

test('Micron persistent native 429 exhausts a bounded three-attempt budget and remains partial without cleanup', { timeout: 6500 }, async t => {
  const transport = boundary(t, { respond: () => limited('0') })
  const jobs = await transport.run()
  assertPartial(jobs)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(transport.details.length, 3)
  await sleep(300)
  assert.equal(transport.details.length, 3, 'An exhausted native request cannot create late retries')
})

test('Micron malformed Retry-After uses bounded local backoff before exact native recovery', { timeout: 5000 }, async t => {
  const transport = boundary(t, { respond: ({ count }) => count === 1 ? limited('not-a-date') : json(nativeDetail) })
  const jobs = await transport.run()
  assert.equal(jobs[0].jobDescription, nativeDetail.data.jobDescription)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(transport.details.length, 2)
  assert.ok(transport.details[1].at - transport.details[0].at >= 950)
})

for (const [name, respond] of [
  ['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } })],
  ['missing full description', () => { const payload = structuredClone(nativeDetail); payload.data.jobDescription = ''; return json(payload) }],
]) test('Micron recovered HTTP access with ' + name + ' remains incomplete without a company blurb', { timeout: 5000 }, async t => {
  const transport = boundary(t, { respond: ({ count }) => count === 1 ? limited('0') : respond() })
  const jobs = await transport.run()
  assertPartial(jobs)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(transport.details.length, 2, 'Non-429 content failures cannot consume another request retry')
})

test('Micron a recovered 429 cannot qualify a foreign native role country', { timeout: 5000 }, async t => {
  const payload = structuredClone(nativeDetail)
  payload.data.locations = ['Boise, Idaho, United States']
  payload.data.standardizedLocations = ['Boise, ID, US']
  const transport = boundary(t, { respond: ({ count }) => count === 1 ? limited('0') : json(payload) })
  await assert.rejects(transport.run(), error => error.incompleteScope === true && /identity mismatch/.test(error.message))
  assert.equal(transport.details.length, 2)
  assert.equal(transport.closes.length, 1)
})

test('Micron unsafe native Retry-After cannot overflow into an immediate retry or healthy result', { timeout: 2500 }, async t => {
  const transport = boundary(t, { respond: () => limited('2147484') })
  const jobs = await transport.run()
  assertPartial(jobs)
  assert.equal(transport.details.length, 1)
})

test('Micron external abort interrupts native Retry-After with the exact opaque reason and no late requests', { timeout: 3500 }, async t => {
  const controller = new AbortController(), observed = deferred()
  const reason = Object.freeze({ get message() { throw Error('Opaque caller reason must not be inspected') } })
  const transport = boundary(t, { signal: controller.signal, respond: () => { observed.resolve(); return limited('5') } })
  const operation = transport.run()
  await observed.promise
  await nextTurn()
  const abortedAt = performance.now()
  controller.abort(reason)
  await assert.rejects(operation, error => error === reason)
  assert.ok(performance.now() - abortedAt < 500)
  await sleep(300)
  assert.equal(transport.details.length, 1)
  assert.equal(transport.closes.length, 1)
})

test('Micron abort settles while a retried native HTTP reader ignores cancellation and observes its late response', { timeout: 5000 }, async t => {
  const controller = new AbortController(), secondStarted = deferred(), pendingResponse = deferred()
  const reason = Object.freeze(new Error('Controlled source deadline'))
  const transport = boundary(t, { signal: controller.signal, respond: ({ count }) => {
    if (count === 1) return limited('0')
    secondStarted.resolve()
    return pendingResponse.promise
  } })
  const operation = transport.run()
  try {
    await secondStarted.promise
    controller.abort(reason)
    await assert.rejects(operation, error => error === reason)
    assert.equal(transport.closes.length, 1)
  } finally { pendingResponse.resolve(json(nativeDetail)) }
  await nextTurn(); await nextTurn()
  assert.equal(transport.details.length, 2)
  assert.equal(transport.closes.length, 1)
})

test('Micron terminal native identity failure cancels queued peer reads before owned browser cleanup', { timeout: 3500 }, async t => {
  const rows = [nativeRow, controlRole(1)]
  const payload = structuredClone(nativeDetail)
  payload.data.publicUrl = 'https://careers.micron.com/careers/job/44649783'
  const transport = boundary(t, { rows, respond: ({ row }) => row.id === nativeRow.id ? json(payload) : json(detailFor(row)) })
  await assert.rejects(transport.run(), error => error.incompleteScope === true)
  assert.equal(transport.closes.length, 1)
  await sleep(600)
  assert.equal(transport.details.length, 1, 'Queued native peers cannot issue requests after terminal source failure')
})

test('Micron modeled 320-role pagination fits the existing five-minute source budget with paced request starts', { timeout: 6000 }, async t => {
  // A deterministic admission clock advances 250ms per observation; native
  // timers stay real so slower-than-budget pacing stalls this control. This
  // models scheduling capacity, not observed network latency or current320
  // native completeness. Each start consumes two clock observations.
  let admissionClock = 0
  t.mock.method(Date, 'now', () => { admissionClock += 250; return admissionClock })
  const rows = Array.from({ length: 320 }, (_, index) => controlRole(index + 1)), requests = []
  const jobs = await createMicronTechnologyIndiaScraper().run({ fetchText: async () => official,
    fetchJson: async url => {
      const request = new URL(url)
      requests.push(request)
      if (request.pathname === '/api/pcsx/search') {
        assert.equal(request.searchParams.get('limit'), '10')
        const offset = Number(request.searchParams.get('start'))
        return { status: 200, error: { message: '', body: '' }, data: { count: 320, positions: rows.slice(offset, offset + 10) } }
      }
      assert.equal(request.pathname, '/api/pcsx/position_details')
      return detailFor(rows.find(row => String(row.id) === request.searchParams.get('position_id')))
    } })
  assert.equal(jobs.length, 320)
  assert.equal(requests.filter(request => request.pathname === '/api/pcsx/search').length, 32)
  assert.equal(requests.length, 352)
  assert.ok(admissionClock <= 176000)
  assert.ok(admissionClock < 300000)
  t.diagnostic('352 scheduled native requests; conservative admission clock ' + admissionClock + 'ms < unchanged300000ms source budget')
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
