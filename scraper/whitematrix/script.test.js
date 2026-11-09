import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  LINKEDIN_COMPANY_JOBS_API_URL,
  LINKEDIN_COMPANY_JOBS_URL,
  LINKEDIN_COMPANY_PAGE_URL,
  SOURCE,
  createWhiteMatrixScraper,
  guestJobsApiShowsListings,
  guestJobsApiShowsZeroResults,
  jobsPageShowsZeroResults,
  pageIndicatesWhiteMatrixCompany,
} from './script.js'

const companyHtml = `
  <html>
    <head>
      <title>WhiteMatrix | LinkedIn</title>
    </head>
    <body>
      <h1>WhiteMatrix</h1>
      <p>Technology, Information and Internet</p>
      <p>The world's first and largest cloud-based multichain IDE for developers to create smart contracts and dApps.</p>
      <a href="https://chainide.com/">Website</a>
    </body>
  </html>
`

const zeroJobsHtml = `
  <html>
    <head>
      <title>0 Jobs jobs in United States</title>
    </head>
    <body>
      <p>0 Jobs jobs in United States</p>
      <p>Sign in</p>
      <p>Join now</p>
    </body>
  </html>
`

const guestJobsEmptyHtml = '<!DOCTYPE html>\n<!---->'

const guestJobsListingsHtml = `
  <div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:123">
    <a href="https://www.linkedin.com/jobs/view/123">Apply now</a>
  </div>
`

test('WhiteMatrix sentinel stays pinned to the public LinkedIn company page and current zero-jobs surface', () => {
  assert.equal(SOURCE, 'whitematrix')
  assert.equal(COMPANY, 'WhiteMatrix')
  assert.equal(LINKEDIN_COMPANY_PAGE_URL, 'https://www.linkedin.com/company/whitematrix/')
  assert.equal(LINKEDIN_COMPANY_JOBS_URL, 'https://www.linkedin.com/jobs/search?f_C=78379149')
  assert.equal(LINKEDIN_COMPANY_JOBS_API_URL, 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?f_C=78379149')
  assert.equal(pageIndicatesWhiteMatrixCompany(companyHtml), true)
  assert.equal(jobsPageShowsZeroResults(zeroJobsHtml), true)
  assert.equal(guestJobsApiShowsZeroResults(guestJobsEmptyHtml), true)
  assert.equal(guestJobsApiShowsListings(guestJobsEmptyHtml), false)
  assert.equal(guestJobsApiShowsListings(guestJobsListingsHtml), true)
})

test('run returns an empty list when WhiteMatrix exposes only the verified zero-jobs LinkedIn public surface', async () => {
  const requestedUrls = []
  const scraper = createWhiteMatrixScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyHtml
      if (url === LINKEDIN_COMPANY_JOBS_URL) return zeroJobsHtml
      if (url === LINKEDIN_COMPANY_JOBS_API_URL) return guestJobsEmptyHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LINKEDIN_COMPANY_PAGE_URL,
    LINKEDIN_COMPANY_JOBS_URL,
    LINKEDIN_COMPANY_JOBS_API_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when WhiteMatrix starts exposing public LinkedIn job cards', async () => {
  const scraper = createWhiteMatrixScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === LINKEDIN_COMPANY_PAGE_URL) return companyHtml
        if (url === LINKEDIN_COMPANY_JOBS_URL) return zeroJobsHtml
        if (url === LINKEDIN_COMPANY_JOBS_API_URL) return guestJobsListingsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified zero-jobs state/i,
  )
})
