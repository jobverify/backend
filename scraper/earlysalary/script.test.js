import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  JOBS_URL,
  REDIRECTED_HOMEPAGE_URL,
  SOURCE,
  createEarlySalaryScraper,
  extractHomepageCareersUrl,
  hasEmptyJobsStateSignal,
  hasOfficialCareersPageSignal,
  hasOfficialRedirectedHomepageSignal,
  isVerifiedMissingJobsRoute,
  pageExposesPublicJobListings,
} from './script.js'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India&#x27;s Largest Lending Platform - Apply for a Personal Loan | Fibe</title>
  </head>
  <body>
    <nav>
      <a href="/about-us/">About Fibe</a>
      <a href="/careers/">Careers</a>
      <a href="/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1>India's Largest Lending Platform</h1>
      <p>Explore jobs at Fibe</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Join our Team | Fibe</title>
    <link rel="canonical" href="https://www.fibe.in/careers/">
  </head>
  <body>
    <section>
      <h2>Be a Part of Fibe</h2>
      <span>No Jobs found</span>
      <button id="button-apply-bottom">Apply Now</button>
    </section>
    <section>
      <h2>Rewards and recognition keep us going</h2>
    </section>
    <script>
      window.__NEXT_DATA__ = "{\\"currentjobopenings\\":{\\"currentjobopeningsdepts\\":null}}";
    </script>
  </body>
</html>
`

const missingJobsRoute = {
  status: 404,
  url: 'https://www.fibe.in/jobs/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>India's Largest Lending Platform | Fibe (formerly EarlySalary)</title>
      </head>
      <body>
        <h1>404</h1>
      </body>
    </html>
  `,
}

test('EarlySalary redirect contract accepts the current Fibe homepage handoff', () => {
  assert.equal(SOURCE, 'earlysalary')
  assert.equal(COMPANY, 'EarlySalary')
  assert.equal(HOMEPAGE_URL, 'https://www.earlysalary.com/')
  assert.equal(REDIRECTED_HOMEPAGE_URL, 'https://www.fibe.in/')
  assert.equal(CAREERS_URL, 'https://www.fibe.in/careers/')
  assert.equal(JOBS_URL, 'https://www.fibe.in/jobs')
  assert.equal(extractHomepageCareersUrl(homepageHtml), CAREERS_URL)
  assert.equal(hasOfficialRedirectedHomepageSignal(homepageHtml), true)
})

test('EarlySalary careers sentinel recognizes the current escaped empty-board payload', () => {
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasEmptyJobsStateSignal(careersHtml), true)
  assert.equal(pageExposesPublicJobListings(careersHtml), false)
  assert.equal(isVerifiedMissingJobsRoute(missingJobsRoute), true)
})

test('EarlySalary scraper returns no jobs while the official Fibe careers board stays empty', async () => {
  const jobs = await createEarlySalaryScraper().run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) {
        return { status: 200, url: REDIRECTED_HOMEPAGE_URL, html: homepageHtml }
      }
      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }
      if (url === JOBS_URL) {
        return missingJobsRoute
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
