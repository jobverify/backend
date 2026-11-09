import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  buildJobsPageUrl,
  createGeVernovaScraper,
  extractIndiaJobs,
  pageHasOfficialJobsListing,
} from '../../scraper/gevernova/script.js'

const listingHtml = `
  <main>
    <h2>Open jobs</h2>
    <div>Showing 11-20 of 2095 jobs</div>
    <article>
      <h3><a href="/lead-sourcing-specialist-supplier-quality-engineering/job/R5012345">Lead Sourcing Specialist - Supplier Quality Engineering</a></h3>
      <div>Job Location Bangalore VERNOVA (JFWTC) IN, EPIP 122 (Phase II), Whitefield Road, Bengaluru, KA</div>
      <time datetime="2026-07-02">2026-07-02</time>
    </article>
    <article>
      <h3><a href="/lead-controls-engineer/job/R5099999">Lead Controls Engineer</a></h3>
      <div>Job Location Wilmington NC US, 3901 Castle Hayne Road, Wilmington, NC</div>
      <time datetime="2026-07-07">2026-07-07</time>
    </article>
  </main>
`

test('buildJobsPageUrl follows the official GE Vernova jobs pagination route', () => {
  assert.equal(CAREERS_URL, 'https://careers.gevernova.com/jobs')
  assert.equal(buildJobsPageUrl(), CAREERS_URL)
  assert.equal(buildJobsPageUrl(2), 'https://careers.gevernova.com/jobs/page/2')
})

test('extractIndiaJobs keeps India listings from the official GE Vernova listing markup', () => {
  assert.deepEqual(extractIndiaJobs(listingHtml), [{
    title: 'Lead Sourcing Specialist - Supplier Quality Engineering',
    location: 'Bangalore VERNOVA (JFWTC) IN, EPIP 122 (Phase II), Whitefield Road, Bengaluru, KA',
    city: 'Bangalore',
    country: 'India',
    jobId: 'R5012345',
    requisitionId: 'R5012345',
    sourceUrl: 'https://careers.gevernova.com/lead-sourcing-specialist-supplier-quality-engineering/job/R5012345',
    applyUrl: 'https://careers.gevernova.com/lead-sourcing-specialist-supplier-quality-engineering/job/R5012345',
    postingDate: '2026-07-02',
  }])
})

test('pageHasOfficialJobsListing accepts the current GE Vernova template counter markup', () => {
  assert.equal(
    pageHasOfficialJobsListing('<main><h2>Open jobs</h2><div>Showing {start_job}-{end_job} of {total} jobs</div></main>'),
    true,
  )
})

test('run returns runner-ready GE Vernova India jobs and validates the official listings surface', async () => {
  const requestedUrls = []
  const scraper = createGeVernovaScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      return listingHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'GE Vernova')
  assert.equal(jobs[0].source, 'gevernova')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(Date.parse(jobs[0].scrapedAt))

  await assert.rejects(
    scraper.run({ fetchText: async () => '<main>Careers home</main>' }),
    /official jobs listing/i,
  )
})
