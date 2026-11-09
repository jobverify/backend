import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createAtidivScraper, extractJobCards, hasOfficialCareersSignal } from '../../scraper/atidiv/script.js'

const currentHtml = `<html><head><title>Careers at Atidiv: Join a Team Driving Innovation and Impact</title></head><body><h2>Current Openings:</h2><h3>Find Your&nbsp;Next Job.</h3><a href="https://atidiv.com/job/senior-campaign-manager/"><h3>Senior Campaign Manager</h3><span class="pr-2">Digital Marketing</span><span>Full-Time</span><span>Remote</span></a></body></html>`

test('Atidiv accepts the current non-www first-party careers and job URL', async () => {
  assert.equal(CAREERS_URL, 'https://atidiv.com/careers/')
  assert.equal(hasOfficialCareersSignal(currentHtml), true)
  assert.deepEqual(extractJobCards(currentHtml).map((job) => job.sourceUrl), ['https://atidiv.com/job/senior-campaign-manager/'])
  const jobs = await createAtidivScraper().run({ fetchText: async () => currentHtml, now: () => '2026-10-03T00:00:00.000Z' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Atidiv')
  assert.equal(jobs[0].link, 'https://atidiv.com/job/senior-campaign-manager/')
})

test('Atidiv rejects a job link on an unrelated host', () => {
  const wrongHost = currentHtml.replace('https://atidiv.com/job/', 'https://other.example/job/')
  assert.equal(hasOfficialCareersSignal(wrongHost), false)
})
