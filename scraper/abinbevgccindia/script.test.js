import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  LINKEDIN_INDIA_JOBS_URL,
  createABInBevGccIndiaScraper,
  extractJobDetail,
  extractSearchResults,
  pageIndicatesLinkedinJobs,
} from './script.js'

const officialSiteHtml = `
  <main>
    <a href="https://www.linkedin.com/company/ab-inbev/jobs/" target="_blank">Search Our Jobs</a>
    <a href="/careers">Careers</a>
  </main>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4429614938">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">High End Specialist</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/ab-inbev">AB InBev</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Mumbai, Maharashtra, India</span>
              <time class="job-search-card__listdate" datetime="2026-06-19">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4429614999">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/other-market-role-4429614999"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Other Market Role</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/ab-inbev">AB InBev</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Leuven, Flanders, Belgium</span>
              <time class="job-search-card__listdate" datetime="2026-06-18">1 week ago</time>
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
      <link rel="canonical" href="https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938">
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "title": "High End Specialist",
          "datePosted": "2026-06-19T04:09:09.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;&lt;strong&gt;Job Description - High End Specialist&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;Responsible for introducing new brands in the market.&lt;/p&gt;",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "AB InBev",
            "sameAs": "https://www.linkedin.com/company/ab-inbev"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Mumbai",
              "addressRegion": "Maharashtra",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
  </html>
`

test('detects the public LinkedIn jobs handoff and keeps only India listings', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.ab-inbev.com/')
  assert.equal(LINKEDIN_INDIA_JOBS_URL, 'https://www.linkedin.com/jobs/search/?f_C=255188&geoId=102713980')
  assert.equal(pageIndicatesLinkedinJobs(officialSiteHtml), true)

  assert.deepEqual(extractSearchResults(searchResultsHtml), [{
    title: 'High End Specialist',
    company: 'AB InBev',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '4429614938',
    requisitionId: '4429614938',
    sourceUrl: 'https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-19',
    closingDate: null,
    jobDescription: null,
  }])
})

test('extracts LinkedIn JobPosting JSON-LD detail fields', () => {
  assert.deepEqual(extractJobDetail(detailHtml), {
    company: 'AB InBev',
    location: 'Mumbai, Maharashtra, IN',
    city: 'Mumbai',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-06-19',
    jobDescription: 'Job Description - High End Specialist Responsible for introducing new brands in the market.',
  })
})

test('run follows the official page to LinkedIn and decorates scraped jobs', async () => {
  const requestedUrls = []
  const scraper = createABInBevGccIndiaScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) return officialSiteHtml
      if (url === LINKEDIN_INDIA_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938')) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    LINKEDIN_INDIA_JOBS_URL,
    'https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'abinbevgccindia')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/high-end-specialist-at-ab-inbev-4429614938?position=1&pageNum=0')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
