import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../myworkday/engine.js'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// The current Airbus India native inventory contains 192 roles. At the shared
// scheduler's real 250 ms start interval, descriptions cannot finish in 30 s.
test('Airbus hydrates every native description at the current inventory size and normal request pacing', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-20T18:00:00Z') })
  const api = 'https://ag.wd3.myworkdayjobs.com/wday/cxs/ag/Airbus'
  const listings = Array.from({ length: 192 }, (_, index) => ({
    title: 'Airbus fixture engineer ' + index,
    externalPath: '/job/Bangalore-Area/Fixture-Engineer_JRTEST' + index,
    locationsText: 'Bangalore Area', postedOn: 'Posted Today',
    bulletFields: ['JRTEST' + index],
  }))
  const detailRequests = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') {
      assert.equal(String(url), api + '/jobs')
      const request = JSON.parse(init.body)
      assert.deepEqual(request.appliedFacets, { locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'] })
      assert.equal(request.searchText, '')
      return Response.json({ total: listings.length, jobPostings: listings.slice(request.offset, request.offset + request.limit) })
    }
    if (!String(url).includes('/job/')) return new Response('<html>Airbus careers</html>')
    assert.ok(String(url).startsWith(api + '/job/'), 'Use the first-party native detail endpoint')
    const listing = listings.find(item => String(url) === api + item.externalPath)
    assert.ok(listing, 'Request a known listing identity')
    detailRequests.push(String(url))
    return Response.json({ jobPostingInfo: {
      title: listing.title, jobReqId: listing.bulletFields[0],
      location: 'Bangalore Area', country: { descriptor: 'India' },
      jobRequisitionLocation: { descriptor: 'Bangalore Area', country: { descriptor: 'India', alpha2Code: 'IN' } },
      jobDescription: '<p>Design and validate aircraft software for ' + listing.bulletFields[0] + '.</p>',
    } })
  })

  let completion
  const running = runWorkdayScraper({
    source: 'airbus', company: 'Airbus',
    baseUrl: 'https://ag.wd3.myworkdayjobs.com/en-US/Airbus',
    scraperDir: fileURLToPath(new URL('../../scraper/airbus.workday', import.meta.url)),
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    boardIdentityVerified: true,
    requestScheduler: new WorkdayRequestScheduler(),
  }).then(value => { completion = { value } }, error => { completion = { error } })

  for (let step = 0; !completion && step < 800; step += 1) {
    await setImmediate()
    t.mock.timers.tick(250)
  }
  assert.ok(completion, 'The finite source budget must allow this workload to finish')
  await running
  if (completion.error) throw completion.error
  const jobs = completion.value
  assert.equal(jobs.length, 192, 'Keep every enumerated India role')
  assert.equal(jobs.filter(job => job.jobDescription?.trim()).length, 192,
    'Do not turn the remaining native descriptions into blank listing fallbacks')
  assert.equal(detailRequests.length, 192)
  assert.equal(new Set(detailRequests).size, 192)
  assert.ok(jobs.every(job => job.sourceDescription.includes(job.requisitionId)))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

