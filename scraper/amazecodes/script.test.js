import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LINKEDIN_COMPANY_PAGE_URL,
  LINKEDIN_INDIA_JOBS_URL,
  createAmazecodesScraper,
  extractJobDetail,
  extractSearchResults,
  pageIndicatesAmazecodesCompany,
} from './script.js'

const sampleCompanyHtml = `
<html>
  <head><title>Amazecodes Solutions Pvt Ltd | LinkedIn</title></head>
  <body>
    <meta content="urn:li:organization:9482063">
  </body>
</html>
`

const sampleSearchHtml = `
<div
  class="base-card base-card--link base-search-card base-search-card--link job-search-card"
  data-entity-urn="urn:li:jobPosting:987654321">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/software-engineer-at-amazecodes-987654321?refId=abc&amp;trackingId=xyz"></a>
  <h3 class="base-search-card__title">
    Software Engineer
  </h3>
  <h4 class="base-search-card__subtitle">
    <a>Amazecodes Solutions Pvt Ltd</a>
  </h4>
  <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
  <time class="job-search-card__listdate" datetime="2026-07-01"/>
</div>
`

const sampleDetailHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Software Engineer",
  "description": "<p>Build backend services.</p><ul><li>Node.js</li><li>APIs</li></ul>",
  "datePosted": "2026-07-01T10:00:00Z",
  "employmentType": "full_time",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Amazecodes Solutions Pvt Ltd"
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
`

test('extractors recognize the public LinkedIn company page and normalize guest-search results', () => {
  assert.equal(pageIndicatesAmazecodesCompany(sampleCompanyHtml), true)

  assert.deepEqual(extractSearchResults(sampleSearchHtml), [{
    title: 'Software Engineer',
    company: 'Amazecodes Solutions Pvt Ltd',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '987654321',
    requisitionId: '987654321',
    sourceUrl: 'https://www.linkedin.com/jobs/view/software-engineer-at-amazecodes-987654321?refId=abc&trackingId=xyz',
    applyUrl: 'https://www.linkedin.com/jobs/view/software-engineer-at-amazecodes-987654321?refId=abc&trackingId=xyz',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: null,
  }])

  assert.deepEqual(extractJobDetail(sampleDetailHtml), {
    company: 'Amazecodes Solutions Pvt Ltd',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-01',
    jobDescription: 'Build backend services. Node.js APIs',
  })
})

test("run requires current native employer/schema and inventory scope beyond legacy meta-only fixtures",async () => {
 const calls=[]
 await assert.rejects(createAmazecodesScraper().run({fetchPage:async url=>{calls.push(url);return{url,status:200,html:sampleCompanyHtml}}}),/current configured native employer identity/)
 assert.deepEqual(calls,[LINKEDIN_COMPANY_PAGE_URL])
})
