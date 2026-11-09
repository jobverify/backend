import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_PAGE_URL,
  buildGreenhouseJobsApiUrl,
  createFive9IndiaScraper,
  hasOfficialCareersLandingSignal,
  hasOfficialJobsPageSignal,
} from './script.js'

const careersLandingHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Contact Center Careers - Five9 Career - SaaS Jobs | Five9</title>
      <link rel="canonical" href="https://www.five9.com/about/careers" />
    </head>
    <body>
      <main>
        <h1>Five9 Careers</h1>
        <a href="/about/careers/jobs">Browse jobs</a>
      </main>
    </body>
  </html>
`

const jobsPageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Five9 Careers - Technical Account Manager Jobs - Five9 Jobs | Five9</title>
      <link rel="canonical" href="https://www.five9.com/about/careers/jobs" />
    </head>
    <body>
      <h2>Search For Jobs</h2>
      <h3>Current Openings</h3>
      <a href="#grnhse_app">Open Greenhouse</a>
      <div id="grnhse_app"></div>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=five9"></script>
    </body>
  </html>
`

const jobsPayload = {
  jobs: [
    {
      id: 5985462004,
      title: 'Technical Support Engineer',
      absolute_url: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
      company_name: 'Five9',
      requisition_id: 'REQ-1',
      location: { name: 'Chennai, India' },
      offices: [{ location: 'Chennai, India' }],
      departments: [{ name: 'Support' }],
      content: '<p>Support customers.</p>',
      updated_at: '2026-08-01T09:00:00Z',
    },
  ],
}

test('Five9 India accepts the current lighter careers landing page while still requiring the verified jobs-page shell', () => {
  assert.equal(hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsPageHtml), true)
})

test('Five9 India run still validates the first-party landing and jobs pages before extracting India jobs from Greenhouse', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createFive9IndiaScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === CAREERS_URL) return careersLandingHtml
      if (url === JOBS_PAGE_URL) return jobsPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === buildGreenhouseJobsApiUrl()) return jobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-02T04:45:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [CAREERS_URL, JOBS_PAGE_URL])
  assert.deepEqual(requestedJsonUrls, [buildGreenhouseJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      location: jobs[0].location,
      link: jobs[0].link,
      source: jobs[0].source,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'Technical Support Engineer',
      location: 'Chennai, India',
      link: 'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
      source: 'five9india',
      scrapedAt: '2026-08-02T04:45:00.000Z',
    },
  )
})
