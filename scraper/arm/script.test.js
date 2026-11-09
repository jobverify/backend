import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildSearchUrl,
  createArmScraper,
  extractJobDetailFromHtml,
  extractSearchResults,
} from './script.js'

const SEARCH_PAGE_HTML = `
<div data-current-page="1" data-total-pages="1" data-total-job-results="1">
  <ul>
    <li class="job-card" data-job-id="78199498832">
      <a class="job-card__title" href="/job/bengaluru/principal-it-solution-architect/33099/78199498832">Principal IT Solution Architect</a>
      <span class="location">Bengaluru, India</span>
      <span class="category">IT</span>
    </li>
  </ul>
</div>
`

const DETAIL_PAGE_HTML = `
<script type="application/ld+json">${JSON.stringify({
  '@context': 'http://schema.org',
  '@type': 'JobPosting',
  title: 'Principal IT Solution Architect',
  datePosted: '2026-05-04',
  jobLocation: [{
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Bangalore',
      addressCountry: 'India',
    },
  }],
  description: [
    '<h2><strong>Job Description:</strong></h2>',
    '<p>Join Arm to shape enterprise architecture strategy.</p>',
    '<h2><strong>Required Skills and Experience:</strong></h2>',
    '<ul>',
    '<li>At least 8 years of experience in a Solution Architect role.</li>',
    '<li>Strong experience with Salesforce, SAP, and integration platforms.</li>',
    '</ul>',
  ].join(''),
})}</script>
`

test('arm extracts India listings from the verified search shell', () => {
  const jobs = extractSearchResults(SEARCH_PAGE_HTML)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Principal IT Solution Architect')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].department, 'IT')
  assert.equal(jobs[0].jobDescription, null)
})

test('arm extracts job descriptions and experience requirements from JobPosting detail pages', () => {
  const detail = extractJobDetailFromHtml(DETAIL_PAGE_HTML, {
    title: 'Principal IT Solution Architect',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    jobId: '78199498832',
    requisitionId: '78199498832',
    sourceUrl: 'https://careers.arm.com/job/bengaluru/principal-it-solution-architect/33099/78199498832',
    applyUrl: 'https://careers.arm.com/job/bengaluru/principal-it-solution-architect/33099/78199498832',
  })

  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.postingDate, '2026-05-04')
  assert.equal(detail.experienceRequired, '8+ years')
  assert.match(detail.jobDescription, /Join Arm to shape enterprise architecture strategy\./)
  assert.match(detail.jobDescription, /At least 8 years of experience in a Solution Architect role\./)
})

test('arm scraper hydrates listings with detail pages before returning jobs', async () => {
  const requests = []
  const jobs = await createArmScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === buildSearchUrl({ page: 1 })) return SEARCH_PAGE_HTML
      if (url === 'https://careers.arm.com/job/bengaluru/principal-it-solution-architect/33099/78199498832') {
        return DETAIL_PAGE_HTML
      }
      throw new Error(`Unexpected URL ${url}`)
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    buildSearchUrl({ page: 1 }),
    'https://careers.arm.com/job/bengaluru/principal-it-solution-architect/33099/78199498832',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].experienceRequired, '8+ years')
  assert.match(jobs[0].jobDescription, /Required Skills and Experience/)
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})
