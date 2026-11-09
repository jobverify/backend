import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { run } from '../../scraper/allucent/script.js'
import { isVerifiedEmptyEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/allucent/workable.json', import.meta.url), 'utf8'))
const india = fixture.pages.flatMap(page => page.payload.results).find(row => row.shortcode === 'A2FC46E741')
const foreign = fixture.pages[0].payload.results[0]
const clone = value => structuredClone(value)
const singlePage = results => [{ payload: { results, total: results.length } }]
const exercise = async ({ pages = clone(fixture.pages), details = [clone(fixture.detail)], ...options } = {}) => {
  let page = 0
  const requests = []
  const jobs = await run({
    now: () => '2026-10-20T18:00:00.000Z', ...options,
    fetchJson: async (url, init = {}) => {
      requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })
      if (init.method === 'POST') {
        assert.equal(url, 'https://apply.workable.com/api/v3/accounts/allucent/jobs')
        assert.ok(pages[page], 'Unexpected extra listing request')
        return pages[page++].payload
      }
      const detail = details.find(row => url === `https://apply.workable.com/api/v2/accounts/allucent/jobs/${row?.shortcode}`)
      return detail || null
    },
  })
  return { jobs, requests }
}

test('Allucent enumerates all four captured Workable cursor pages before returning its complete India detail', async () => {
  const { jobs, requests } = await exercise()
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.title, 'Senior Clinical Data Manager - I')
  assert.equal(job.company, 'Allucent')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.sourceUrl, 'https://apply.workable.com/allucent/j/A2FC46E741/')
  assert.equal(job.applyUrl, 'https://apply.workable.com/allucent/j/A2FC46E741/apply/')
  assert.equal(job.link, job.applyUrl)
  assert.equal(job.scrapedAt, '2026-10-20T18:00:00.000Z')
  assert.match(job.sourceDescription, /Senior Clinical Data Manager/)
  assert.match(job.sourceDescription, /Requirements[\s\S]*Minimum 5 years/)
  assert.match(job.sourceDescription, /Benefits[\s\S]*Comprehensive benefits package/)
  assert.ok(job.jobDescription.length > 7000)
  assert.equal(requests.length, 5)
  assert.deepEqual(requests.slice(0, 4).map(request => request.body), fixture.pages.map(page => page.request))
  assert.equal(requests[4].method, 'GET')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 32)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.pagesFetched, 4)
  assert.equal(evidence.verifiedAt, '2026-10-20T18:00:00.000Z')
})

test('Allucent distinguishes a complete foreign inventory from an explicitly empty verified board', async () => {
  const foreignOnly = await exercise({ pages: singlePage([clone(foreign)]) })
  assert.equal(foreignOnly.jobs.length, 0)
  assert.equal(readInventoryEvidence(foreignOnly.jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(foreignOnly.jobs).reportedTotal, 1)
  const empty = await exercise({ pages: singlePage([]) })
  assert.equal(empty.jobs.length, 0)
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(empty.jobs)), true)
})

test('Allucent includes India secondary offices while preserving each explicit country scope', async () => {
  const row = clone(india), detail = clone(fixture.detail)
  row.location = clone(foreign.location)
  row.locations.unshift(clone(foreign.locations[0]))
  detail.location = clone(row.location)
  detail.locations = clone(row.locations)
  const { jobs } = await exercise({ pages: singlePage([row]), details: [detail] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
})

test('Allucent fails closed on cursor loops, repeated records, inconsistent totals and truncated terminal pages', async () => {
  const first = clone(foreign), second = clone(fixture.pages[0].payload.results[1])
  for (const pages of [
    [{ payload: { total: 32, results: [first], nextPage: 'loop' } }, { payload: { total: 32, results: [second], nextPage: 'loop' } }],
    [{ payload: { total: 2, results: [first], nextPage: 'next' } }, { payload: { total: 2, results: [first] } }],
    [{ payload: { total: 2, results: [first], nextPage: 'next' } }, { payload: { total: 3, results: [second] } }],
    [{ payload: { total: 2, results: [first] } }],
    [{ payload: { total: 1, results: [first], nextPage: null } }],
    [{ payload: { total: 0, results: [], nextPage: 'next' } }],
    [{ payload: { total: '0', results: [] } }],
  ]) await assert.rejects(exercise({ pages }), /cursor|duplicate|total|incomplete|contract|count/i)
})

test('Allucent rejects configured pagination caps instead of returning a partial successful inventory', async () => {
  await assert.rejects(exercise({ maxPages: 3 }), /limit|cap|incomplete/i)
})

test('Allucent rejects malformed or unknown geography even on foreign or multi-location records', async () => {
  const cases = [null, [], [{ country: 'France' }], [{ countryCode: '??', country: 'France' }],
    [{ countryCode: 'US', country: 'India' }], [{ countryCode: 'IN', country: 'Unknown' }]]
  for (const locations of cases) {
    const row = clone(foreign)
    row.locations = locations
    await assert.rejects(exercise({ pages: singlePage([row]) }), /location|geograph|country|scope/i)
  }
  const row = clone(india)
  row.locations.push({ country: 'Undeclared' })
  await assert.rejects(exercise({ pages: singlePage([row]) }), /location|geograph|country|scope/i)
})

test('Allucent rejects nonpublic rows and duplicate numeric or public job identities', async () => {
  for (const patch of [{ state: 'draft' }, { isInternal: true }, { accountUid: 'other-account' }, { id: null }, { shortcode: '../other' }]) {
    await assert.rejects(exercise({ pages: singlePage([{ ...clone(foreign), ...patch }]) }), /public|identity|account|record/i)
  }
  for (const patch of [{ id: foreign.id + 1 }, { shortcode: 'ABCDEF1234' }]) {
    await assert.rejects(exercise({ pages: singlePage([clone(foreign), { ...clone(foreign), ...patch }]) }), /duplicate/i)
  }
})

test('Allucent requires every India detail to preserve identity, geography and all employer content sections', async () => {
  await assert.rejects(exercise({ details: [] }), /detail|identity/i)
  for (const patch of [{ id: 1 }, { shortcode: 'ABCDEF1234' }, { title: 'Different role' }, { accountUid: 'other-account' },
    { state: 'draft' }, { isInternal: true }, { locations: [clone(foreign.locations[0])] },
    { description: '' }, { requirements: null }, { benefits: '  ' }]) {
    await assert.rejects(exercise({ details: [{ ...clone(fixture.detail), ...patch }] }), /detail|identity|account|public|country|location|section|content/i)
  }
})

test('Allucent validates all India details before an output cap and preserves incomplete lifecycle markers', async () => {
  const second = { ...clone(india), id: 6008559, shortcode: 'B2FC46E742' }
  const secondDetail = { ...clone(fixture.detail), id: 6008559, shortcode: 'B2FC46E742' }
  const { jobs, requests } = await exercise({ pages: singlePage([clone(india), second]), details: [clone(fixture.detail), secondDetail], maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(requests.filter(request => request.method === 'GET').length, 2)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Allucent default transport verifies native HTTP success and exact tenant URL before accepting explicit zero', async t => {
  const url = 'https://apply.workable.com/api/v3/accounts/allucent/jobs'
  let status = 403, finalUrl = url
  t.mock.method(globalThis, 'fetch', async (requested, init) => {
    assert.equal(requested, url)
    assert.ok(init.signal instanceof AbortSignal)
    const response = Response.json({ total: 0, results: [] }, { status })
    Object.defineProperty(response, 'url', { value: finalUrl })
    return response
  })
  await assert.rejects(run(), /HTTP|redirect/i)
  status = 200; finalUrl = 'https://apply.workable.com/api/v3/accounts/unrelated/jobs'
  await assert.rejects(run(), /HTTP|redirect/i)
  finalUrl = url
  assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(await run())), true)
})

test('Allucent never treats a native error envelope as an explicitly empty inventory', async () => {
  for (const patch of [{ error: 'Unavailable' }, { errors: ['Unavailable'] }, { success: false }]) {
    await assert.rejects(exercise({ pages: [{ payload: { total: 0, results: [], ...patch } }] }), /error|contract/i)
  }
})

test('Allucent catalog activates the native parser alongside the verified historical inventory snapshot', async () => {
  const { getScraperCatalog } = await import('../providers/index.js')
  const { default: catalog } = await import('../../scraper/allucent/catalog.js')
  const provider = getScraperCatalog().find(row => row.source === 'allucent')
  for (const entry of [catalog, provider]) {
    assert.equal(entry.atsPlatform, 'workable-native-api')
    assert.equal(entry.backfillMode, 'live-parser')
    assert.equal(entry.zeroResultPolicy, 'evidence-required')
    assert.equal(entry.verifiedPublicJobCount, 32)
    assert.equal(entry.verifiedIndiaJobCount, 1)
    assert.equal(entry.verifiedInventoryStatus, 'complete-inventory')
  }
})
