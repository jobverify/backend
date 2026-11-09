import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LINKEDIN_COMPANY_PAGE_URL,
  LINKEDIN_INDIA_JOBS_URL,
  createAltenIndiaScraper,
  extractJobDetail,
  extractSearchResults,
  pageIndicatesAltenIndiaCompany,
} from './script.js'

const companyPageHtml = `
  <html>
    <head>
      <title>ALTEN India | LinkedIn</title>
    </head>
    <body>
      <code id="flagshipOrganizationTracking" style="display: none"><!--{"organization":{"objectUrn":"urn:li:organization:2312703"}}--></code>
      <a href="https://www.alten-india.com/">Company website</a>
    </body>
  </html>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:555001">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Software Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/alten-india/">ALTEN India</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-06-21">2 weeks ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:555002">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/software-architect-at-alten-india-555002"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Software Architect</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/alten-india/">ALTEN India</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Toulouse, Occitanie, France</span>
              <time class="job-search-card__listdate" datetime="2026-06-18">2 weeks ago</time>
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
          "datePosted": "2026-06-21T08:00:00.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Design and build embedded software platforms.&lt;/p&gt;",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "ALTEN India"
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

test('ALTEN India scraper constants stay pinned to the public LinkedIn company and India jobs pages', () => {
  assert.equal(LINKEDIN_COMPANY_PAGE_URL, 'https://www.linkedin.com/company/alten-india/')
  assert.equal(LINKEDIN_INDIA_JOBS_URL, 'https://www.linkedin.com/jobs/search/?f_C=2312703&geoId=102713980')
  assert.equal(pageIndicatesAltenIndiaCompany(companyPageHtml), true)
})

test('extractSearchResults keeps only India jobs from the public LinkedIn guest search page', () => {
  assert.deepEqual(extractSearchResults(searchResultsHtml), [{
    title: 'Software Engineer',
    company: 'ALTEN India',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '555001',
    requisitionId: '555001',
    sourceUrl: 'https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-21',
    closingDate: null,
    jobDescription: null,
  }])
})

test('extractJobDetail reads JobPosting JSON-LD and run decorates scraped jobs', async () => {
  assert.deepEqual(extractJobDetail(detailHtml), {
    company: 'ALTEN India',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-06-21',
    experienceRequired: null,
    jobDescription: 'Design and build embedded software platforms.',
    publicExperienceChecked: null,
  })

  const requestedUrls = []
  const scraper = createAltenIndiaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === LINKEDIN_COMPANY_PAGE_URL) return companyPageHtml
      if (url === LINKEDIN_INDIA_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001')) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    LINKEDIN_COMPANY_PAGE_URL,
    LINKEDIN_INDIA_JOBS_URL,
    'https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'altenindia')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/software-engineer-at-alten-india-555001?position=1&pageNum=0')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
