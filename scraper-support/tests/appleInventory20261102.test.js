import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchUrl, createAppleScraper } from '../../scraper/apple/script.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const html = loaderData => `<script>window.__staticRouterHydrationData = JSON.parse(${JSON.stringify(JSON.stringify({ loaderData }))});</script>`
const listing = id => ({ reqId: String(id), id: String(id), postingTitle: `Engineer ${id}`,
  transformedPostingTitle: `engineer-${id}`, jobSummary: 'Listing summary only.',
  locations: [{ name: 'Bengaluru', countryName: 'India' }], team: { teamCode: 'SFTWR' } })
const page = (number, records, total) => html({ search: { page: number, searchResults: records, totalRecords: total } })
const detail = id => html({ jobDetails: { jobsData: { reqId: String(id), id: String(id),
  postingTitle: `Engineer ${id}`, description: 'Build production services and maintain reliable infrastructure with the engineering team.',
  minimumQualifications: 'Experience building and maintaining production systems.' } } })

function fixture({ changedClosing = false, failedDetail = null, invalidEnvelope = false } = {}) {
  const calls = [], first = page(1, [listing(1), listing(2)], 3), last = page(2, [listing(3)], 3)
  let firstReads = 0
  return { calls, fetchText: async (url, options = {}) => {
    options.signal?.throwIfAborted()
    calls.push(url)
    if (url === buildSearchUrl()) {
      firstReads++
      if (invalidEnvelope) return html({ search: {} })
      return changedClosing && firstReads > 1 ? page(1, [listing(1), listing(4)], 3) : first
    }
    if (url === buildSearchUrl({ page: 2 })) return last
    const id = new URL(url).pathname.match(/\/details\/(\d+)\//)?.[1]
    if (!id) throw new Error('Unexpected source URL')
    if (id === failedDetail) throw new Error('HTTP response body interrupted')
    return detail(id)
  } }
}

test('Apple reconciles a short final page and a stable closing inventory into complete evidence', async () => {
  const f = fixture()
  const jobs = await createAppleScraper().run({ fetchText: f.fetchText })
  assert.equal(jobs.length, 3)
  assert.equal(f.calls.filter(url => url === buildSearchUrl()).length, 2)
  assert.equal(f.calls.filter(url => url === buildSearchUrl({ page: 2 })).length, 2)
  assert.ok(jobs.every(job => job.sourceDetailComplete === true))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.reportedTotal, 3)
  assert.equal(evidence?.indiaFacetCount, 3)
  assert.equal(evidence?.listingComplete, true)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), true)
})

for (const options of [{ maxJobs: 1 }, { maxPages: 1 }]) {
  test(`Apple explicit cap ${JSON.stringify(options)} retains partial evidence and forbids cleanup`, async () => {
    const f = fixture()
    const jobs = await createAppleScraper(options).run({ fetchText: f.fetchText })
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 3)
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  })
}

test('Apple changed closing role identities keep the collected jobs partial', async () => {
  const f = fixture({ changedClosing: true })
  const jobs = await createAppleScraper().run({ fetchText: f.fetchText })
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.match(readInventoryEvidence(jobs)?.reason || '', /changed/)
})

test('Apple retains healthy role details when one detail response fails without certifying the listing summary', async () => {
  const f = fixture({ failedDetail: '2' })
  const jobs = await createAppleScraper().run({ fetchText: f.fetchText })
  assert.equal(jobs.length, 3)
  assert.equal(jobs.find(job => job.jobId === '2').sourceDetailComplete, false)
  assert.equal(hasSourceDescription(jobs.find(job => job.jobId === '2')), false)
  assert.equal(jobs.find(job => job.jobId === '1').sourceDetailComplete, true)
  assert.equal(jobs.find(job => job.jobId === '3').sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Apple missing inventory envelope cannot be reported as an empty successful search', async () => {
  const f = fixture({ invalidEnvelope: true })
  await assert.rejects(createAppleScraper().run({ fetchText: f.fetchText }), /inventory|envelope|search/i)
})

test('Apple wrong-role detail cannot contribute its description or qualifications to another role', async () => {
  const f = fixture()
  const jobs = await createAppleScraper().run({ fetchText: (url, options) => /\/details\/2\//.test(url)
    ? detail(999) : f.fetchText(url, options) })
  const wrong = jobs.find(job => job.jobId === '2')
  assert.equal(wrong.sourceDetailComplete, false)
  assert.equal(wrong.jobDescription, null)
  assert.equal(wrong.sourceNativeListingDescription, 'Listing summary only.')
  assert.equal(hasSourceDescription(wrong), false)
  assert.equal(wrong.minimumQualification, null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Apple binds a localized listing to the detail publisher jobNumber instead of its internal REQ identifier', async () => {
  const record = { ...listing(1), reqId: '1-0321', id: '1-0321', positionId: '1' }
  const localized = page(1, [record], 1)
  const full = html({ jobDetails: { jobsData: { reqId: 'REQ-1', id: 'REQ-1', positionId: '1',
    jobNumber: '1-0321', postingTitle: 'Engineer 1', locations: [{ countryName: 'India', postingIdentifier: '0321' }],
    description: 'Build and maintain reliable production services.' } } })
  const jobs = await createAppleScraper().run({ fetchText: async url => url === buildSearchUrl() ? localized : full })
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].jobId, '1-0321')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

for (const requestId of ['PIPE-1', '1-0321']) {
  test(`Apple binds ${requestId} through publisher pipeline and location posting identities`, async () => {
    const record = { ...listing(1), reqId: requestId, id: requestId, positionId: '1', type: 'PIPE' }
    const search = page(1, [record], 1)
    const full = html({ jobDetails: { jobsData: { reqId: 'PIPE-1', id: 'PIPE-1', positionId: '1',
      jobNumber: '1', postingTitle: 'Engineer 1', locations: [{ countryName: 'India', postingIdentifier: '0321' }],
      description: 'Build and maintain reliable production services.' } } })
    const jobs = await createAppleScraper().run({ fetchText: async url => url === buildSearchUrl() ? search : full })
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  })
}

test('Apple does not invent a localized identity from the position without its native posting identifier', async () => {
  const record = { ...listing(1), reqId: '1-0321', positionId: '1' }
  const search = page(1, [record], 1)
  const full = html({ jobDetails: { jobsData: { reqId: 'PIPE-1', id: 'PIPE-1', positionId: '1',
    jobNumber: '1', postingTitle: 'Engineer 1', locations: [{ countryName: 'India', postingIdentifier: '9999' }],
    description: 'Build and maintain reliable production services.' } } })
  const jobs = await createAppleScraper().run({ fetchText: async url => url === buildSearchUrl() ? search : full })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Apple conflicting native jobNumber and position identity cannot qualify a detail', async () => {
  const record = { ...listing(1), reqId: '1-0321', positionId: '1' }
  const search = page(1, [record], 1)
  const full = html({ jobDetails: { jobsData: { reqId: 'REQ-999', id: 'REQ-999', positionId: '999',
    jobNumber: '1-0321', postingTitle: 'Engineer 1', description: 'Build and maintain reliable production services.' } } })
  const jobs = await createAppleScraper().run({ fetchText: async url => url === buildSearchUrl() ? search : full })
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('Apple an empty search without current India-filter proof stays incomplete', async () => {
  const jobs = await createAppleScraper().run({ fetchText: async () => page(1, [], 0) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('Apple a foreign-only result from the India filter cannot certify zero India jobs', async () => {
  const foreign = { ...listing(1), locations: [{ name: 'Austin', countryName: 'United States' }] }
  const jobs = await createAppleScraper().run({ fetchText: async url =>
    url === buildSearchUrl() ? page(1, [foreign], 1) : detail(1) })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.indiaFacetCount, null)
  assert.match(evidence?.reason || '', /india-filter|india-scope/i)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
})

test('Apple cancellation reaches source requests and does not start more pages', async () => {
  const controller = new AbortController(), reason = new Error('cancel this source'), calls = []
  const f = fixture()
  await assert.rejects(createAppleScraper().run({ signal: controller.signal, fetchText: async (url, options) => {
    calls.push(url)
    assert.equal(options?.signal, controller.signal)
    controller.abort(reason)
    return f.fetchText(url, options)
  } }), error => error === reason)
  assert.equal(calls.length, 1)
})
