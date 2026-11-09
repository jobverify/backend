import assert from 'node:assert/strict'
import test from 'node:test'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { createBaseelScraper } from '../../scraper/baseel/script.js'

test('an Eightfold posting with empty native locations has unknown country', () => {
  const scope = readEightfoldLocationScope({ locations: [], standardizedLocations: [] })
  assert.deepEqual(scope, { location: null, country: null, indiaLocations: [],
    nativeLocations: [], standardizedLocations: [], unresolved: true })
  for (const record of [{}, { locations: [null] }, { locations: [], standardizedLocations: ['Bengaluru, KA, IN'] }]) {
    assert.throws(() => readEightfoldLocationScope(record), /native location/)
  }
})

test('an empty-location Infineon row cannot erase proven India roles or authorize cleanup', async () => {
  const provider = structuredClone(getScraperCatalog().find(p => p.source === 'infineon'))
  delete provider.publicAccessPolicy
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0 }
  const rows = [
    { id: 1, displayJobId: 'HRC1', name: 'Unknown workplace', locations: [], standardizedLocations: [], positionUrl: '/careers/job/1' },
    { id: 2, displayJobId: 'HRC2', name: 'India engineer', locations: ['Bangalore (India)'],
      standardizedLocations: ['Bengaluru, KA, IN'], positionUrl: '/careers/job/2' },
  ]
  const details = []
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    if (url.includes('/position_details')) {
      const id = Number(new URL(url).searchParams.get('position_id'))
      details.push(id)
      return { data: { ...rows.find(row => row.id === id), publicUrl: `https://jobs.infineon.com/careers/job/${id}`,
        jobDescription: 'Current employer role responsibilities and qualifications. '.repeat(8) } }
    }
    return { data: { positions: rows, count: rows.length } }
  } })
  assert.deepEqual(details, [2])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceListingComplete, false)
  const inventoryEvidence = readInventoryEvidence(jobs)
  assert.equal(inventoryEvidence.listingComplete, false)
  assert.equal(inventoryEvidence.indiaFacetCount, null)
  assert.match(inventoryEvidence.reason, /native-location-scope-unresolved/)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence }), { replaceExisting: false })
})

test('an all-unknown Eightfold feed cannot become verified empty', async () => {
  const provider = structuredClone(getScraperCatalog().find(p => p.source === 'infineon'))
  delete provider.publicAccessPolicy
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0 }
  const jobs = await runApiPortalScraper({ provider, fetchJson: async () => ({ data: {
    positions: [{ id: 1, name: 'Unlocated role', locations: [], standardizedLocations: [] }], count: 1,
  } }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('the demonstrated Porto campus can be excluded as Portugal while the same role retains its independent India office', () => {
  const scope = readEightfoldLocationScope({ locations: ['Porto (Maia)', 'Bangalore'],
    standardizedLocations: ['Porto, Porto District, PT', 'Bengaluru, KA, IN'] })
  assert.deepEqual(scope.indiaLocations, ['Bangalore'])
  assert.equal(scope.unresolved, false)
  assert.throws(() => readEightfoldLocationScope({ locations: ['Porto (unreviewed campus)'],
    standardizedLocations: ['Porto, Porto District, PT'] }), /unaligned/)
})

test('structured HTTP failures retain their classification through nested causes', () => {
  for (const status of [401, 402, 403, 406, 407, 429, 451]) {
    const cause = Object.assign(new Error('Public recruiting access unavailable'), { status })
    const error = new Error('Source HTTP failure', { cause: new Error('Native inventory unavailable', { cause }) })
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied' })
  }
  assert.equal(classifyScraperError(Object.assign(new Error('Source HTTP failure'), { response: { status: 503 } })).failureKind, 'network_or_timeout')
  assert.equal(classifyScraperError(Object.assign(new Error('Source HTTP failure'), { statusCode: 404 })).failureKind, 'surface_drift_or_fail_closed')
  const cyclic = new Error('Native identity mismatch')
  cyclic.cause = cyclic
  assert.equal(classifyScraperError(cyclic).softFailure, false)
})

test('CrewBloom preserves its first-party HTTP denial before issuing any Workable inventory request', async () => {
  const provider = getScraperCatalog().find(p => p.source === 'crewbloom')
  let requests = 0
  await assert.rejects(createCatalogScraper(provider).run({
    fetchPage: async url => { requests++; return { status: 403, url, html: 'Public access denied' } },
    fetchJson: async () => { assert.fail('A denied employer page cannot authorize subsequent inventory requests') },
  }), error => error.status === 403 && classifyScraperError(error).failureKind === 'blocked_or_access_denied')
  assert.equal(requests, 1)
})

test('Baseel stops a pending injected request on caller cancellation without reading another route', async () => {
  const controller = new AbortController(), reason = new Error('Source cancelled')
  let requests = 0, observedSignal
  const pending = createBaseelScraper().run({ signal: controller.signal, fetchPage: async (_url, { signal }) => {
    requests++; observedSignal = signal
    controller.abort(reason)
    return new Promise(() => {})
  } })
  await assert.rejects(pending, error => error === reason)
  assert.equal(requests, 1)
  assert.equal(observedSignal.aborted, true)
})

test('Baseel bounds default HTTP requests and retains the timeout as an upstream failure', async t => {
  let observedSignal
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    observedSignal = signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const keepAlive = setInterval(() => {}, 1000)
  try {
    await assert.rejects(createBaseelScraper().run({ requestTimeoutMs: 20 }), error => {
      assert.equal(error.name, 'TimeoutError')
      assert.equal(classifyScraperError(error).failureKind, 'network_or_timeout')
      return true
    })
    assert.equal(observedSignal.aborted, true)
  } finally { clearInterval(keepAlive) }
})
