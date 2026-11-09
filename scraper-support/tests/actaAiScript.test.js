import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentCaptures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/actaai/test-data/current-public-20261103.json.gz',import.meta.url))))

const loadActaAiModule = async () => {
  try {
    return await import('../../scraper/actaai/script.js')
  } catch {
    return null
  }
}

const companyPageHtml = `
  <html>
    <head>
      <title>Acta.ai | LinkedIn</title>
    </head>
    <body>
      <code id="flagshipOrganizationTracking" style="display: none"><!--{"organization":{"objectUrn":"urn:li:organization:98814926"}}--></code>
      <a href="https://acta.ai">Company website</a>
    </body>
  </html>
`

const zeroJobsSearchHtml = `
  <html>
    <head>
      <title>0 jobs in India</title>
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
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:999001">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/founding-ai-engineer-at-acta-ai-999001?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Founding AI Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/acta-ai">Acta.ai</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Hyderabad, Telangana, India</span>
              <time class="job-search-card__listdate" datetime="2026-06-20">1 week ago</time>
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
          "datePosted": "2026-06-20T09:00:00.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;Build agentic meeting intelligence systems.&lt;/p&gt;",
          "title": "Founding AI Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Acta.ai"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Hyderabad",
              "addressRegion": "Telangana",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

test('pageIndicatesActaCompany validates the public LinkedIn company page and search parsing keeps India jobs', async () => {
  const actaAi = await loadActaAiModule()
  assert.ok(actaAi)

  assert.equal(actaAi.pageIndicatesActaCompany(companyPageHtml), true)

  const jobs = actaAi.extractSearchResults(searchResultsHtml)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Founding AI Engineer',
    company: 'Acta.ai',
    department: null,
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: '999001',
    requisitionId: '999001',
    sourceUrl: 'https://in.linkedin.com/jobs/view/founding-ai-engineer-at-acta-ai-999001?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/founding-ai-engineer-at-acta-ai-999001?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-20',
    closingDate: null,
    jobDescription: null,
  })
})

test('extractJobDetail enriches a public LinkedIn ACTA.ai detail page using JobPosting JSON-LD', async () => {
  const actaAi = await loadActaAiModule()
  assert.ok(actaAi)

  const detail = actaAi.extractJobDetail(detailHtml)

  assert.deepEqual(detail, {
    company: 'Acta.ai',
    location: 'Hyderabad, Telangana, IN',
    city: 'Hyderabad',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-06-20',
    jobDescription: 'Build agentic meeting intelligence systems.',
  })
})

test('run retains current ACTA.ai announcements without promoting a keyword-filtered guest query to employer zero', async () => {
  const actaAi = await loadActaAiModule()
  assert.ok(actaAi)

  const requestedUrls = []
  const scraper = actaAi.createActaAiScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      const row=currentCaptures.find(row=>row.url===url);assert.ok(row)
      return{status:row.status,url:row.finalURL,html:row.body}
    },
  })

  assert.deepEqual(requestedUrls, [
    actaAi.LINKEDIN_COMPANY_PAGE_URL,
    actaAi.LINKEDIN_INDIA_JOBS_URL,
    actaAi.LINKEDIN_COMPANY_PAGE_URL,
    actaAi.LINKEDIN_INDIA_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
