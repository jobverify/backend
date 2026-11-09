import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LINKEDIN_COMPANY_ID,
  LINKEDIN_COMPANY_PAGE_URL,
  LINKEDIN_INDIA_JOBS_URL,
  createSuperagiScraper,
  extractIndiaJobListings,
  pageIndicatesSuperagiCompany,
  pageIndicatesSuperagiIndiaJobsSearch,
} from './script.js'

const companyPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>SuperAGI | LinkedIn</title>
  </head>
  <body>
    <script type="application/ld+json">
      {
        "slogan": "AI-Native CRM for unified Sales, Marketing & Support.",
        "sameAs": "https://superagi.com?utm_source=linkedin&utm_medium=social&utm_campaign=superagi"
      }
    </script>
    <div data-semaphore-content-urn="urn:li:organization:${LINKEDIN_COMPANY_ID}"></div>
  </body>
</html>
`

const noMatchJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <button data-tracking-control-name="public_jobs_f_C">SuperAGI</button>
    <a href="?f_C=${LINKEDIN_COMPANY_ID}&geoId=102713980">Jobs</a>
    <section class="core-section-container my-3 no-results">
      <h1>We couldn't find a match for <strong>Jobs jobs in India</strong></h1>
    </section>
  </body>
</html>
`

const jobsHtml = `
${noMatchJobsHtml}
<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:4370222448">
  <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/software-development-engineer-ii-sde-ii-at-superagi-4370222448?position=1&amp;pageNum=0">
    <h3 class="base-search-card__title"> Software Development Engineer II (SDE II) </h3>
  </a>
  <h4 class="base-search-card__subtitle"><a>SuperAGI</a></h4>
  <span class="job-search-card__location">Coimbatore, Tamil Nadu, India</span>
  <time class="job-search-card__listdate" datetime="2026-07-30"></time>
</div>
<div class="base-card job-search-card" data-entity-urn="urn:li:jobPosting:9999999999">
  <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/not-superagi-9999999999?position=2&amp;pageNum=0">
    <h3 class="base-search-card__title"> Ignore Me </h3>
  </a>
  <h4 class="base-search-card__subtitle"><a>Another Company</a></h4>
  <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
  <time class="job-search-card__listdate" datetime="2026-07-31"></time>
</div>
`

test('SuperAGI validates the verified LinkedIn company and India jobs search surfaces', () => {
  assert.equal(pageIndicatesSuperagiCompany(companyPageHtml), true)
  assert.equal(pageIndicatesSuperagiIndiaJobsSearch(noMatchJobsHtml), true)
})

test('SuperAGI returns zero jobs only for the verified empty LinkedIn India jobs search', async () => {
  const requestedUrls = []

  const jobs = await createSuperagiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === LINKEDIN_INDIA_JOBS_URL) return noMatchJobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LINKEDIN_COMPANY_PAGE_URL,
    LINKEDIN_INDIA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SuperAGI extracts public India LinkedIn job cards and fails closed on search-shell drift', async () => {
  const jobs = await createSuperagiScraper().run({
    fetchText: async (url) => {
      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === LINKEDIN_INDIA_JOBS_URL) return jobsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-05T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Development Engineer II (SDE II)')
  assert.equal(jobs[0].company, 'SuperAGI')
  assert.equal(jobs[0].city, 'Coimbatore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, '4370222448')
  assert.equal(jobs[0].scrapedAt, '2026-08-05T00:00:00.000Z')

  assert.equal(extractIndiaJobListings(jobsHtml).length, 1)

  await assert.rejects(
    createSuperagiScraper().run({
      fetchText: async (url) => {
        if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
        if (url === LINKEDIN_INDIA_JOBS_URL) return '<html><body>LinkedIn results changed</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs search no longer matches/i,
  )
})
