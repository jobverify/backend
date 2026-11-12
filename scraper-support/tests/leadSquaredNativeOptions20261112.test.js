import assert from 'node:assert/strict'
import test from 'node:test'

import { createDarwinboxScraper } from '../../scraper/darwinbox/script.js'
import { createLeadSquaredScraper } from '../../scraper/leadsquared/script.js'

const listing = (jd = '<p>Build and maintain the employer sales execution platform.</p>') => ({
  status: 'success', job_counts: 1,
  data: [{ id: 'lead-native-role', title: 'Platform Engineer', country: 'India', locations: 'Bengaluru, Karnataka, India', jd }],
})
const detail = () => ({ status: 'success', message: { job: [{
  id: 'lead-native-role', title: 'Platform Engineer', country: 'India', officelocation_show_arr: 'Bengaluru, Karnataka, India',
  jd: '<p>Design employer platform services and operate reliable sales workflows.</p>',
}] } })
const configured = (fetchImpl) => createLeadSquaredScraper({
  darwinboxScraper: createDarwinboxScraper({
    source: 'leadsquared', companyName: 'LeadSquared', origin: 'https://leadsquaredhrms.darwinbox.in', fetchImpl,
  }),
})

for (const customListing of [false, true]) {
  test(`LeadSquared stops an already cancelled ${customListing ? 'injected' : 'native'} listing before requesting the source`, async () => {
    const reason = new Error('caller cancelled LeadSquared')
    let requests = 0
    const scraper = configured(async () => { requests++; return Response.json(listing()) })
    await assert.rejects(scraper.run({
      signal: AbortSignal.abort(reason),
      ...(customListing ? { fetchListingPage: async () => { requests++; return listing() } } : {}),
    }), error => error === reason)
    assert.equal(requests, 0)
  })

  test(`LeadSquared preserves caller cancellation during an ${customListing ? 'injected' : 'native'} listing request`, async () => {
    const controller = new AbortController()
    const reason = new Error('cancel active LeadSquared request')
    let listingPosts = 0
    const scraper = configured(async (_url, init) => {
      if (init.method === 'GET') {
        controller.abort(reason)
        return new Response('<html>Public careers</html>')
      }
      listingPosts++
      return Response.json(listing())
    })
    await assert.rejects(scraper.run({
      signal: controller.signal,
      ...(customListing ? { fetchListingPage: async () => { controller.abort(reason); return listing() } } : {}),
    }), error => error === reason)
    assert.equal(listingPosts, 0)
  })
}

test('LeadSquared passes native detail recovery to the real Darwinbox extractor', async () => {
  const scraper = configured(async (_url, init) => init.method === 'POST'
    ? Response.json(listing('')) : new Response('<html>Public careers</html>'))
  const jobs = await scraper.run({ fetchJobDetail: async () => detail() })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, '<p>Design employer platform services and operate reliable sales workflows.</p>')
  assert.equal(jobs[0].sourceDetailComplete, true)
})

test('LeadSquared respects the native detail budget and keeps missing source content incomplete', async () => {
  let nativeDetails = 0
  const scraper = configured(async (url, init) => {
    if (init.method === 'POST') return Response.json(listing(''))
    if (url.includes('/candidateapi/job/')) nativeDetails++
    return new Response('<html>Public careers</html>')
  })
  const jobs = await scraper.run({ detailEnrichmentBudgetMs: 0 })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(nativeDetails, 0)
})
