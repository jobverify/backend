import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchUrl, createAppleScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const html = loaderData => `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({ loaderData }))});</script>`
const row = id => ({ reqId: String(id), id: String(id), postingTitle: `Engineer ${id}`,
  transformedPostingTitle: `engineer-${id}`, locations: [{ name: 'Bengaluru', countryName: 'India' }] })
const listing = page => html({ search: { page, totalRecords: 3,
  searchResults: page === 1 ? [row(1), row(2)] : [row(3)] } })
const detail = id => html({ jobDetails: { jobsData: { reqId: String(id), id: String(id),
  postingTitle: `Engineer ${id}`, description: 'Build reliable production services and maintain engineering infrastructure.' } } })
const drain = () => new Promise(resolve => setImmediate(() => setImmediate(resolve)))

test('Apple keeps detail workers busy across pages while an earlier page has one slow role', async () => {
  const slow = Promise.withResolvers()
  let laterStarted = false, active = 0, peak = 0
  const running = createAppleScraper({ detailConcurrency: 2 }).run({ fetchText: async url => {
    if (url === buildSearchUrl()) return listing(1)
    if (url === buildSearchUrl({ page: 2 })) return listing(2)
    const id = Number(new URL(url).pathname.split('/')[3])
    active++; peak = Math.max(peak, active)
    if (id === 1) await slow.promise
    if (id === 3) laterStarted = true
    active--
    return detail(id)
  } })
  let beforeRelease
  try { await drain(); beforeRelease = laterStarted } finally { slow.resolve() }
  const jobs = await running
  assert.equal(beforeRelease, true, 'A free detail worker must reach the next page before the slow role returns')
  assert.equal(peak, 2)
  assert.deepEqual(jobs.map(job => job.jobId), ['1', '2', '3'])
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Apple reconciles closing pages concurrently without omitting any opening identity', async () => {
  const slow = Promise.withResolvers(), reads = new Map()
  let laterClosingStarted = false
  const running = createAppleScraper().run({ fetchText: async url => {
    const page = url === buildSearchUrl() ? 1 : url === buildSearchUrl({ page: 2 }) ? 2 : null
    if (!page) return detail(Number(new URL(url).pathname.split('/')[3]))
    const count = (reads.get(page) || 0) + 1
    reads.set(page, count)
    if (count === 2 && page === 1) await slow.promise
    if (count === 2 && page === 2) laterClosingStarted = true
    return listing(page)
  } })
  let beforeRelease
  try { await drain(); beforeRelease = laterClosingStarted } finally { slow.resolve() }
  const jobs = await running
  assert.equal(beforeRelease, true, 'A closing page must not hold all other closing page reads')
  assert.deepEqual([...reads], [[1, 2], [2, 2]])
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})


test('Apple returns only completed identity-verified roles at its own collection deadline', async () => {
  const jobs = await createAppleScraper({ collectionTimeoutMs: 40, detailConcurrency: 2 }).run({ fetchText: async url => {
    if (url === buildSearchUrl()) return listing(1)
    if (url === buildSearchUrl({ page: 2 })) return listing(2)
    if (url.includes('/details/1/')) return detail(1)
    return new Promise(() => {})
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['1'])
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /collection-deadline/)
  assert.equal(jobs.nativeCollectionEvidence.collectionDeadlineReached, true)
  assert.equal(jobs.nativeCollectionEvidence.validatedDetailRoles, 1)
  assert.equal(jobs.nativeCollectionEvidence.listedRoles, 3)
})

test('Apple propagates caller cancellation instead of returning its internally bounded partial result', async () => {
  const controller = new AbortController(), reason = Error('caller cancelled Apple')
  const running = createAppleScraper({ collectionTimeoutMs: 1000, detailConcurrency: 1 }).run({ signal: controller.signal,
    fetchText: async url => {
      if (url === buildSearchUrl()) return listing(1)
      if (url === buildSearchUrl({ page: 2 })) return listing(2)
      if (url.includes('/details/1/')) return detail(1)
      controller.abort(reason)
      return new Promise(() => {})
    } })
  await assert.rejects(running, error => error === reason)
})


test('Apple rejects collection budgets that could outlive the outer runner deadline', async () => {
  for (const collectionTimeoutMs of [0, -1, 270001, Infinity, '240000']) {
    await assert.rejects(createAppleScraper({ collectionTimeoutMs }).run({
      fetchText: async () => assert.fail('An invalid source budget must fail before native reads'),
    }), /collection deadline/i)
  }
})


test('Apple closing failure aborts and settles sibling reads before returning held validated roles', async () => {
  const gate = Promise.withResolvers(), counts = new Map(), closingPages = [], siblingSignals = []
  const running = createAppleScraper().run({ fetchText: async (url, options) => {
    if (url.includes('/details/')) return detail(Number(new URL(url).pathname.split('/')[3]))
    const number = Number(new URL(url).searchParams.get('page') || 1), count = (counts.get(number) || 0) + 1
    counts.set(number, count)
    if (count === 2) {
      closingPages.push(number)
      if (number === 1) return '<html>bad closing response</html>'
      siblingSignals.push(options.signal)
      await gate.promise
    }
    return html({ search: { page: number, totalRecords: 5, searchResults: [row(number)] } })
  } })
  let returned, abortedAtReturn
  try {
    returned = await Promise.race([running, drain().then(() => null)])
    abortedAtReturn = siblingSignals.length > 0 && siblingSignals.every(signal => signal.aborted)
  } finally { gate.resolve() }
  const jobs = await running
  await drain()
  assert.ok(returned, 'A closing failure must abort noncooperative siblings and finish without waiting for their later success')
  assert.equal(abortedAtReturn, true, 'Sibling request signals must be aborted before the source returns')
  assert.deepEqual(closingPages, [1, 2, 3, 4], 'A failed closing pool cannot schedule page five after returning')
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing-inventory-unavailable/)
})

test('Apple closing pool preserves an external caller abort reason', async () => {
  const controller = new AbortController(), reason = Error('caller cancelled closing inventory'), counts = new Map()
  const running = createAppleScraper().run({ signal: controller.signal, fetchText: async url => {
    if (url.includes('/details/')) return detail(Number(new URL(url).pathname.split('/')[3]))
    const number = Number(new URL(url).searchParams.get('page') || 1), count = (counts.get(number) || 0) + 1
    counts.set(number, count)
    if (count === 2 && number === 1) { controller.abort(reason); return new Promise(() => {}) }
    return html({ search: { page: number, totalRecords: 5, searchResults: [row(number)] } })
  } })
  await assert.rejects(running, error => error === reason)
})
