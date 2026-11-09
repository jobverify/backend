import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOBS_URL,
  createWebkulSoftwareScraper,
  extractJobCards,
  hasOfficialJobDetailSignal,
  hasOfficialJobsPageSignal,
} from './script.js'

const jobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Open Positions</h1>
    <a href="https://webkul.com/jobs/performance-marketing-specialist/" class="op-block">
      <h5 class="op-name">Performance Marketing Specialist</h5>
      <div class="op-info">
        <span>Experience: 4-6 Years</span>
        <span>Open Position: 1</span>
      </div>
    </a>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Performance Marketing Specialist</h1>
    <p>Webkul Software</p>
    <div class="job-location" data-val="Noida"></div>
    <div class="exp" data-val="4-6 Years"></div>
    <div class="count" data-val="1"></div>
    <p>Apply Now</p>
  </body>
</html>
`

test('Webkul accepts the current first-party jobs and detail-page contract', () => {
  assert.equal(hasOfficialJobsPageSignal(jobsHtml), true)
  assert.equal(hasOfficialJobDetailSignal(detailHtml, 'Performance Marketing Specialist'), true)
})

test('Webkul extracts the current performance marketing role card', () => {
  const cards = extractJobCards(jobsHtml)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].title, 'Performance Marketing Specialist')
})

test('Webkul returns jobs when detail pages now use Apply Now instead of Apply By Github', async () => {
  const jobs = await createWebkulSoftwareScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === JOBS_URL) return jobsHtml
      if (url === 'https://webkul.com/jobs/performance-marketing-specialist/') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Performance Marketing Specialist')
  assert.equal(jobs[0].sourceUrl, 'https://webkul.com/jobs/performance-marketing-specialist/')
})
