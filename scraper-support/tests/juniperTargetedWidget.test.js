import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from '../../scraper/juniper/script.js'

const lpKey = 'l-hpe-juniper-networking'
const query = '(description.description_phenom:("#networking"))'
const row = (id, country = 'India') => ({reqId: id,jobId: id,jobSeqNo: 'HPE1US' + id,title: 'Network Engineer ' + id,country,cityStateCountry: country === 'India' ? 'Bengaluru, India' : 'London, United Kingdom'})
const response = (jobs, totalHits = jobs.length) => ({targetedJobs: {status: 200,totalHits,hits: jobs.length,lpKey,eid: {searchType: 'landingPage',query},data: {jobs}}})
const noListingHtml = async () => { throw new Error('Juniper listings must use their advertised targetedJobs API') }

test('Juniper requests the official landing-page key and one complete 359-record targeted inventory', async () => {
  let calls = 0
  const result = await run({detailEnrichmentBudgetMs: 0,fetchText: noListingHtml,fetchJson: async (url, options) => {
    calls++;assert.equal(url, 'https://careers.hpe.com/widgets')
    const body = JSON.parse(options.body)
    assert.equal(body.ddoKey, 'targetedJobs');assert.deepEqual(body.lpKey, [lpKey])
    assert.equal(body.size, 500);assert.equal(body.from, 0)
    assert.equal(body.pageName, 'HPE Juniper Networking')
    assert.ok(options.signal)
    return response(Array.from({length: 359}, (_, index) => row(String(index + 1), index < 156 ? 'India' : 'United Kingdom')))
  }})
  assert.equal(calls, 1);assert.equal(result.length, 156)
  assert.equal(new Set(result.map(job => job.jobId)).size, 156)
  assert.ok(result.every(job => job.country === 'India' && job.company === 'Juniper Networks' && job.sourceListingComplete !== false))
})

for (const change of ['key', 'query']) {
  test('Juniper rejects a targeted API response that loses its official scope: ' + change, async () => {
    const payload = response([row('1')])
    if (change === 'key') payload.targetedJobs.lpKey = 'all-hpe-jobs'
    else payload.targetedJobs.eid.query = ''
    await assert.rejects(run({detailEnrichmentBudgetMs: 0,fetchText: noListingHtml,fetchJson: async () => payload}), /Juniper.*scope/i)
  })
}

test('Juniper keeps the shared unique-record completeness guard when a later page repeats', async () => {
  await assert.rejects(run({detailEnrichmentBudgetMs: 0,fetchText: noListingHtml,fetchJson: async () => response([row('1')], 2)}), /duplicate page/i)
})

test('Juniper rejects malformed API success and forwards caller cancellation', async () => {
  await assert.rejects(run({detailEnrichmentBudgetMs: 0,fetchText: noListingHtml,fetchJson: async () => ({targetedJobs: {status: 200,totalHits: 0}})}), /invalid listing payload/)
  let calls = 0;const reason = new Error('Juniper cancelled')
  await assert.rejects(run({signal: AbortSignal.abort(reason),fetchText: noListingHtml,fetchJson: async () => {calls++;return response([])}}), error => error === reason)
  assert.equal(calls, 0)
})
