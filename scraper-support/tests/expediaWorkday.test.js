import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from '../../scraper/expedia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const apiUrl = 'https://expedia.wd108.myworkdayjobs.com/wday/cxs/expedia/search/jobs'
const facets = { locations: ['c553432013ba103bbc5b28efceb250b1', 'c553432013ba103bbc5cc6e3faef5396'] }
const job = index => ({title: 'Engineer ' + index, externalPath: '/job/India---Bangalore/Engineer_R-' + index, locationsText: index % 2 ? 'India - Bangalore' : 'India - Gurgaon', bulletFields: ['R-' + index]})

test('Expedia uses the publicly linked Workday board and both verified India locations through complete pagination', async t => {
 const requests = []
 t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
  assert.equal(new URL(url).hostname, 'expedia.wd108.myworkdayjobs.com')
  if (options.method !== 'POST') return new Response('<html>Workday</html>')
  assert.equal(url, apiUrl)
  const body = JSON.parse(options.body); requests.push(body)
  assert.deepEqual(body.appliedFacets, facets)
  assert.equal(body.searchText, '')
  const jobPostings = Array.from({length: Math.min(20, 21 - body.offset)}, (_, index) => job(body.offset + index + 1))
  return Response.json({total: body.offset ? 0 : 21, jobPostings})
 })
 const jobs = await run({detailEnrichmentBudgetMs: 0, now: () => '2026-09-13T00:00:00.000Z'})
 assert.deepEqual(requests.map(r => r.offset), [0, 20])
 assert.equal(jobs.length, 21)
 assert.equal(new Set(jobs.map(j => j.link)).size, 21)
 assert.equal(new Set(jobs.map(j => j.jobId)).size, 21)
 assert.ok(jobs.every(j => /^R-\d+$/.test(j.jobId) && j.requisitionId === j.jobId))
 assert.ok(jobs.every(j => j.source === 'expedia' && j.company === 'Expedia' && j.country === 'India'))
 assert.ok(jobs.every(j => j.scrapedAt === '2026-09-13T00:00:00.000Z'))
 assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
 assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 21)
 assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 21)
})

test('Expedia rejects a malformed public API success instead of publishing an empty snapshot', async t => {
 t.mock.method(globalThis, 'fetch', async (_url, options = {}) => options.method === 'POST' ? Response.json({total: 0}) : new Response('<html>Workday</html>'))
 await assert.rejects(run({detailEnrichmentBudgetMs: 0}), /invalid success payload/)
})

test('Expedia passes cancellation to the public Workday scraper before requests', async t => {
 let calls = 0
 t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected fetch') })
 await assert.rejects(run({signal: AbortSignal.abort(new Error('Expedia cancelled'))}), /Expedia cancelled/)
 assert.equal(calls, 0)
})
