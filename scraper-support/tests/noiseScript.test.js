import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createNoiseScraper, extractJobsFromListingHtml, hasFreshteamListingSignal } from '../../scraper/noise/script.js'

const LISTING_HTML = '<title>Noise</title><h2>Open Positions</h2>' +
  '<a href="/jobs/RodgS3EvA4lZ/business-head"><h5>Business Head</h5><span>Gurgaon</span><span>Full Time</span><p>Lead a new business vertical.</p></a>' +
  '<a href="/jobs/yaPEK4IM49cr/business-head-emerging-business"><h5>Business Head - Emerging Business</h5><span>Gurgaon</span><span>Full Time</span><p>Build and grow the emerging category.</p></a>'

test('Freshteam signal requires the verified Noise listing markers', () => {
  assert.equal(hasFreshteamListingSignal(LISTING_HTML), true)
  assert.equal(hasFreshteamListingSignal('<title>Other</title><h2>Open Positions</h2>'), false)
  assert.equal(hasFreshteamListingSignal('<title>Noise</title><h2>Open Positions</h2>'), false)
})

test('extractJobsFromListingHtml maps first-party Freshteam openings', () => {
  const jobs = extractJobsFromListingHtml(LISTING_HTML)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), ['Business Head', 'Business Head - Emerging Business'])
  assert.equal(jobs[0].company, 'Noise')
  assert.equal(jobs[0].location, 'Gurgaon')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(jobs[0].sourceUrl, 'https://gonoise.freshteam.com/jobs/RodgS3EvA4lZ/business-head')
  assert.equal(jobs[0].jobDescription, 'Lead a new business vertical.')
})

test('Noise scraper validates the listing surface before extracting jobs', async () => {
  let fetchedUrl = null
  const jobs = await createNoiseScraper().run({ fetchText: async (url) => { fetchedUrl = url; return LISTING_HTML } })
  assert.equal(fetchedUrl, CAREERS_URL)
  assert.equal(jobs.length, 2)
})
