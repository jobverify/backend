import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  buildSearchUrl,
  createDanaIncorporatedScraper,
  extractSearchResults,
} from './script.js'

const LISTING_HTML = `
  <div class="job-listing">
    <a href="/job/Pune-Controls-Engineer-MH-410501/1388728000/">Controls Engineer</a>
    <span class="job-location">Pune, MH, IN, 410501</span>
    <time datetime="2026-07-06">Jul 6, 2026</time>
  </div>
  <div class="job-listing">
    <a href="/job/Toledo-Assembly-Technician-OH-43610/1388728001/">Assembly Technician</a>
    <span class="job-location">Toledo, OH, US, 43610</span>
    <time datetime="2026-07-06">Jul 6, 2026</time>
  </div>
`

test('buildSearchUrl points to Dana Incorporated official all-jobs page', () => {
  assert.equal(CAREER_PAGE_URL, 'https://jobs.dana.com/go/View-All-Jobs/9152900/')
  assert.equal(buildSearchUrl(), CAREER_PAGE_URL)
})

test('extractSearchResults returns only India jobs with canonical URLs', () => {
  assert.deepEqual(extractSearchResults(LISTING_HTML), [
    {
      title: 'Controls Engineer',
      company: 'Dana Incorporated',
      location: 'Pune, MH, IN, 410501',
      applyUrl: 'https://jobs.dana.com/job/Pune-Controls-Engineer-MH-410501/1388728000/',
      sourceUrl: CAREER_PAGE_URL,
      postedDate: '2026-07-06',
    },
  ])
})

test('createDanaIncorporatedScraper injects fetch and adds source metadata', async () => {
  const requestedUrls = []
  const scraper = createDanaIncorporatedScraper({ maxJobs: 1 })
  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return LISTING_HTML
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'danaincorporated')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
