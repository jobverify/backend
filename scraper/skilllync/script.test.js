import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACCEPTED_UNAVAILABLE_STATUSES,
  CAREERS_URL,
  COMPANY,
  JOBS_URL,
  SOURCE,
  createSkillLyncScraper,
  hasOfficialCareersSignal,
  hasOfficialJobsPageSignal,
  hasRenderedPublicJobCards,
  isVerifiedUnavailablePage,
} from './script.js'

const careersHtml = `
  <html>
    <body>
      <h1>Make a positive career move. Reach for the stars!</h1>
      <p>Evolve with us and create the future of learning! Learning is everything here.</p>
      <a href="https://skill-lync.com/careers/jobs">Click To View Openings</a>
    </body>
  </html>
`

const jobsShellHtml = `
  <html>
    <body>
      <section>
        <h2>CURRENT OPENINGS</h2>
        <p>Filter by location</p>
        <p>Filter by team</p>
        <p>Filter by work type</p>
        <button>Clear All</button>
      </section>
      <section>
        <h2>SPEAK WITH US</h2>
      </section>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <body>
      <section>
        <h2>CURRENT OPENINGS</h2>
        <a href="/careers/jobs/sales-manager">View jobs</a>
        <a href="/careers/jobs/sales-manager/apply">Apply now</a>
      </section>
    </body>
  </html>
`

const unavailableHtml = `
  <html>
    <head>
      <title>503 Service Temporarily Unavailable</title>
    </head>
    <body>
      <center><h1>503 Service Temporarily Unavailable</h1></center>
    </body>
  </html>
`

const badGatewayHtml = `
  <html>
    <head>
      <title>502 Bad Gateway</title>
    </head>
    <body>
      <center><h1>502 Bad Gateway</h1></center>
    </body>
  </html>
`

test('Skill-Lync sentinel stays pinned to the first-party careers page and current-openings shell', () => {
  assert.equal(SOURCE, 'skilllync')
  assert.equal(COMPANY, 'Skill-Lync')
  assert.equal(CAREERS_URL, 'https://www.skill-lync.com/careers')
  assert.equal(JOBS_URL, 'https://skill-lync.com/careers/jobs')
  assert.deepEqual(ACCEPTED_UNAVAILABLE_STATUSES, [502, 503])
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialJobsPageSignal(jobsShellHtml), true)
  assert.equal(hasRenderedPublicJobCards(jobsShellHtml), false)
  assert.equal(hasRenderedPublicJobCards(publicJobsHtml), true)
  assert.equal(
    isVerifiedUnavailablePage({
      status: 503,
      url: CAREERS_URL,
      html: unavailableHtml,
    }),
    true,
  )
  assert.equal(
    isVerifiedUnavailablePage({
      status: 502,
      url: CAREERS_URL,
      html: badGatewayHtml,
    }),
    true,
  )
})

test('run returns an empty list when Skill-Lync exposes only a current-openings shell without rendered public jobs', async () => {
  const requestedUrls = []
  const scraper = createSkillLyncScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_URL) {
        return {
          status: 200,
          url: CAREERS_URL,
          html: careersHtml,
        }
      }

      if (url === JOBS_URL) {
        return {
          status: 200,
          url: JOBS_URL,
          html: jobsShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_URL])
  assert.deepEqual(jobs, [])
})

test('run returns an empty list when both official Skill-Lync pages match the verified temporary-unavailable 503 shell', async () => {
  const requestedUrls = []
  const scraper = createSkillLyncScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      return {
        status: 503,
        url,
        html: unavailableHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_URL])
  assert.deepEqual(jobs, [])
})

test('run returns an empty list when both official Skill-Lync pages match the verified temporary-unavailable 502 shell', async () => {
  const requestedUrls = []
  const scraper = createSkillLyncScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      return {
        status: 502,
        url,
        html: badGatewayHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, JOBS_URL])
  assert.deepEqual(jobs, [])
})
