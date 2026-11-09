import assert from 'node:assert/strict'
import test from 'node:test'

import { createBetsolScraper, API_URL } from './script.js'

const board = `<html><head><title>Careers at BETSOL</title></head><body>
<h2>Jobs at Betsol LLC</h2>
<section data-qty="1" class="openings-section"><h3>Bengaluru, India</h3>
<a href="https://jobs.smartrecruiters.com/BETSOL/123-india-role">India role</a></section>
<section data-qty="1" class="openings-section"><h3>New York, NY</h3>
<a href="https://jobs.smartrecruiters.com/BETSOL/456-us-role">US role</a></section>
</body></html>`
const india = { id: '123', name: 'India role', company: { identifier: 'BETSOL', name: 'BETSOL' }, location: { city: 'Bengaluru', region: 'KA', country: 'in', fullLocation: 'Bengaluru, KA, India' }, visibility: 'PUBLIC' }
const us = { id: '456', name: 'US role', company: { identifier: 'BETSOL', name: 'BETSOL' }, location: { city: 'New York', region: 'NY', country: 'us' }, visibility: 'PUBLIC' }

test('BETSOL reads every current India posting from the complete SmartRecruiters API', async () => {
  const requested = []
  const jobs = await createBetsolScraper({ now: () => '2026-10-03T00:00:00.000Z' }).run({
    fetchText: async () => board,
    fetchJson: async (url) => {
      requested.push(url)
      if (url === `${API_URL}?limit=100&offset=0`) return { offset: 0, limit: 100, totalFound: 2, content: [india, us] }
      if (url === `${API_URL}/123`) return { ...india, active: true, postingUrl: 'https://jobs.smartrecruiters.com/BETSOL/123-india-role', applyUrl: 'https://jobs.smartrecruiters.com/BETSOL/123-india-role?oga=true', jobAd: { sections: { jobDescription: { text: '<p>Build software</p>' } } } }
      throw new Error(`Unexpected API URL ${url}`)
    },
  })
  assert.deepEqual(requested, [`${API_URL}?limit=100&offset=0`, `${API_URL}/123`])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, KA, India')
  assert.equal(jobs[0].sourceUrl, 'https://jobs.smartrecruiters.com/BETSOL/123-india-role')
})

test('BETSOL fails closed if the board count and public API count disagree', async () => {
  await assert.rejects(createBetsolScraper().run({
    fetchText: async () => board,
    fetchJson: async () => ({ offset: 0, limit: 100, totalFound: 1, content: [india] }),
  }), /inventory/i)
})
