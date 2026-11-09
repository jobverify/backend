import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  INDIA_OVERVIEW_URL,
  buildSearchUrl,
  createEmpowerScraper,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
  hasIndiaOverviewSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const HOMEPAGE_URL = 'https://www.empower.com/'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Empower</h1>
      <a href="https://jobs.empower.com/">Careers</a>
    </body>
  </html>
`

const overviewHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <p>Country Head, India</p>
      <p>Our Bangalore office is an integral part of a global financial services organization.</p>
      <a href="/india-jobs">All India jobs</a>
    </body>
  </html>
`

test('validates the verified official Empower homepage and India overview surface', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasIndiaOverviewSignal(overviewHtml), true)
  assert.equal(buildSearchUrl(), 'https://jobs.empower.com/india-jobs')
  assert.equal(buildSearchUrl({ page: 2 }), 'https://jobs.empower.com/india-jobs?p=2')
})

test('extractSearchResults keeps only India jobs from Empower public search pages', () => {
  const html = `
    <section id="search-results-list">
      <a href="/job/bengaluru/senior-analyst-payroll/42743/97460719120" data-job-id="97460719120">
        <h2>Senior Analyst Payroll</h2>
        <span class="sr-facet job-location">Bengaluru, India</span>
      </a>
      <a href="/job/greenwood-village/lead-engineer/42743/123456789" data-job-id="123456789">
        <h2>Lead Engineer</h2>
        <span class="sr-facet job-location">Greenwood Village, United States</span>
      </a>
    </section>
  `

  const jobs = extractSearchResults(html)

  assert.deepEqual(jobs, [
    {
      title: 'Senior Analyst Payroll',
      company: 'Empower',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '97460719120',
      requisitionId: '97460719120',
      sourceUrl: 'https://jobs.empower.com/job/bengaluru/senior-analyst-payroll/42743/97460719120',
      applyUrl: 'https://jobs.empower.com/job/bengaluru/senior-analyst-payroll/42743/97460719120',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('extractPaginationSummary reads Empower next-page routes', () => {
  assert.deepEqual(
    extractPaginationSummary('<a class="next" href="/india-jobs?p=2">Next</a>'),
    { nextUrl: 'https://jobs.empower.com/india-jobs?p=2' },
  )
})

test('extractJobDetail reads Empower detail metadata and Workday apply links', () => {
  const html = `
    <meta name="search-job-apply-url" content="https://empower.wd12.myworkdayjobs.com/empower/job/KA-Bangalore/Senior-Analyst-Payroll_R0059851/apply">
    <script type="application/ld+json">{
      "@context":"http://schema.org",
      "@type":"JobPosting",
      "title":"Senior Analyst Payroll",
      "identifier":"R0059851",
      "industry":"Payroll",
      "employmentType":"Full time",
      "datePosted":"2026-06-22",
      "description":"<p>Lead payroll analysis for India operations.</p><p>Partner with finance stakeholders.</p>",
      "hiringOrganization":{"@type":"Organization","name":"Empower"},
      "jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Bengaluru","addressCountry":"India"}}]
    }</script>
    <h1 class="job-details--title">Senior Analyst Payroll</h1>
    <div data-selector-name="jobdetails" data-job-id="97460719120"></div>
    <p class="job-details--location">Bengaluru, India</p>
  `

  const detail = extractJobDetail(html, {
    title: 'Senior Analyst Payroll',
    jobId: '97460719120',
    requisitionId: '97460719120',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    sourceUrl: 'https://jobs.empower.com/job/bengaluru/senior-analyst-payroll/42743/97460719120',
  })

  assert.equal(detail.title, 'Senior Analyst Payroll')
  assert.equal(detail.company, 'Empower')
  assert.equal(detail.department, 'Payroll')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '97460719120')
  assert.equal(detail.requisitionId, 'R0059851')
  assert.equal(
    detail.applyUrl,
    'https://empower.wd12.myworkdayjobs.com/empower/job/KA-Bangalore/Senior-Analyst-Payroll_R0059851/apply',
  )
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, '2026-06-22')
  assert.match(detail.jobDescription, /Lead payroll analysis/i)
})

test('run validates Empower source surfaces before scraping India jobs', async () => {
  const requestedUrls = []
  const listingHtml = `
    <section id="search-results-list">
      <a href="/job/bengaluru/senior-analyst-payroll/42743/97460719120" data-job-id="97460719120">
        <h2>Senior Analyst Payroll</h2>
        <span class="sr-facet job-location">Bengaluru, India</span>
      </a>
    </section>
  `
  const detailHtml = `
    <meta name="search-job-apply-url" content="https://empower.wd12.myworkdayjobs.com/empower/job/KA-Bangalore/Senior-Analyst-Payroll_R0059851/apply">
    <script type="application/ld+json">{"title":"Senior Analyst Payroll","identifier":"R0059851","industry":"Payroll","employmentType":"Full time","datePosted":"2026-06-22","description":"<p>Lead payroll analysis for India operations.</p>","hiringOrganization":{"name":"Empower"},"jobLocation":[{"address":{"addressLocality":"Bengaluru","addressCountry":"India"}}]}</script>
    <h1 class="job-details--title">Senior Analyst Payroll</h1>
    <div data-selector-name="jobdetails" data-job-id="97460719120"></div>
    <p class="job-details--location">Bengaluru, India</p>
  `

  const jobs = await createEmpowerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === INDIA_OVERVIEW_URL) return overviewHtml
      if (url === CAREER_PAGE_URL) return listingHtml
      if (url === 'https://jobs.empower.com/job/bengaluru/senior-analyst-payroll/42743/97460719120') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    INDIA_OVERVIEW_URL,
    CAREER_PAGE_URL,
    'https://jobs.empower.com/job/bengaluru/senior-analyst-payroll/42743/97460719120',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'empower')
  assert.equal(jobs[0].company, 'Empower')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
