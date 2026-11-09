import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LINKEDIN_COMPANY_JOBS_URL,
  LINKEDIN_COMPANY_PAGE_URL,
  createWeRizeScraper,
  extractJobDetail,
  extractSearchResults,
  pageIndicatesWeRizeCompany,
} from './script.js'

const companyPageHtml = `
  <html>
    <head>
      <title>WeRize | LinkedIn</title>
    </head>
    <body>
      <a href="https://www.werize.com/">Website</a>
      <p>India's first full stack financial services platform for small city India</p>
    </body>
  </html>
`

const zeroJobsSearchHtml = `
  <html>
    <head>
      <title>0 jobs worldwide</title>
    </head>
    <body>
      <section class="jobs-search__results-list"></section>
    </body>
  </html>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:456780001">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Senior Product Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://in.linkedin.com/company/werize">WeRize</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-07-09">2 days ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:456780002">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/city-manager-at-werize-456780002?position=2&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">City Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://in.linkedin.com/company/werize">WeRize</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Dubai, United Arab Emirates</span>
              <time class="job-search-card__listdate" datetime="2026-07-08">3 days ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-07-09T09:00:00.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Lead product execution for lending workflows across India.&lt;/p&gt;",
          "title": "Senior Product Manager",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "WeRize"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

test('WeRize scraper constants stay pinned to the public LinkedIn company and jobs pages', () => {
  assert.equal(LINKEDIN_COMPANY_PAGE_URL, 'https://in.linkedin.com/company/werize')
  assert.equal(
    LINKEDIN_COMPANY_JOBS_URL,
    'https://www.linkedin.com/jobs/werize-jobs-worldwide?f_C=14560906&trk=top-card_top-card-primary-button-top-card-primary-cta',
  )
  assert.equal(pageIndicatesWeRizeCompany(companyPageHtml), true)
})

test('extractSearchResults keeps only India jobs from the public LinkedIn guest jobs page', () => {
  assert.deepEqual(extractSearchResults(searchResultsHtml), [{
    title: 'Senior Product Manager',
    company: 'WeRize',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '456780001',
    requisitionId: '456780001',
    sourceUrl: 'https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001?position=1&pageNum=0',
    applyUrl: 'https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: null,
  }])
})

test('extractJobDetail reads JobPosting JSON-LD and run returns an empty list when no India jobs are published', async () => {
  assert.deepEqual(extractJobDetail(detailHtml), {
    company: 'WeRize',
    location: 'Bengaluru, Karnataka, IN',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-09',
    jobDescription: 'Lead product execution for lending workflows across India.',
  })

  const requestedUrls = []
  const scraper = createWeRizeScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === LINKEDIN_COMPANY_JOBS_URL) return zeroJobsSearchHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LINKEDIN_COMPANY_PAGE_URL,
    LINKEDIN_COMPANY_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fetches LinkedIn company, jobs, and detail pages and returns enriched scraper output', async () => {
  const requestedUrls = []
  const scraper = createWeRizeScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === LINKEDIN_COMPANY_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001')) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LINKEDIN_COMPANY_PAGE_URL,
    LINKEDIN_COMPANY_JOBS_URL,
    'https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'werize')
  assert.equal(jobs[0].company, 'WeRize')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].link,
    'https://www.linkedin.com/jobs/view/senior-product-manager-at-werize-456780001?position=1&pageNum=0',
  )
})
