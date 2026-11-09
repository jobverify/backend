import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  createAesTechnologiesScraper,
  extractJobDetail,
  extractListings,
  pageIndicatesJobs,
} from './script.js'

const listingsHtml = `
<section>
  <h2>Current Openings</h2>
  <a href="/job-detail/319">
    <b>Presales Solution Architect - Azure Data &amp; AI [Remote]</b>
  </a>
</section>
`

const detailHtml = `
<div class="careers-details">
  <a href="/apply-job/319"><b>Presales Solution Architect - Azure Data &amp; AI [Remote]</b></a>
  <p>Lead presales conversations for Azure data and AI programs.</p>
  <ul>
    <li>Partner with delivery teams.</li>
    <li>Support solution design.</li>
  </ul>
</div>
`

const currentNoDetailListingsHtml = `
<main>
  <h1>Careers</h1>
  <p>AES provides IT services, business solutions and outsourcing.</p>
  <h2>Current Openings</h2>
  <h3><strong>Note:</strong> Click the job Title to Apply</h3>
  <table>
    <tr><td><b>APPLICATION MAINTENANCE SUPPORT PROJECT(24*7)</b></td></tr>
    <tr><td><b>Location-Singapore</b></td></tr>
    <tr><td><b>DOTNET</b></td></tr>
    <tr><td><b>PHP</b></td></tr>
  </table>
</main>
`

test('extractListings recognizes the AES Technologies careers markup', () => {
  assert.equal(pageIndicatesJobs(listingsHtml), true)
  assert.deepEqual(extractListings(listingsHtml), [{
    title: 'Presales Solution Architect - Azure Data & AI [Remote]',
    detailUrl: 'https://careers.advanceecomsolutions.com/job-detail/319',
    requisitionId: '319',
  }])
})

test('extractJobDetail normalizes the AES Technologies detail page fields', () => {
  assert.deepEqual(
    extractJobDetail(detailHtml, {
      title: 'Presales Solution Architect - Azure Data & AI [Remote]',
      requisitionId: '319',
    }),
    {
      title: 'Presales Solution Architect - Azure Data & AI [Remote]',
      company: 'AES Technologies',
      department: 'Presales Solution Architect - Azure Data & AI [Remote]',
      location: 'Remote, India',
      city: null,
      country: 'India',
      jobId: 'aestechnologies-319',
      requisitionId: '319',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: 'https://careers.advanceecomsolutions.com/apply-job/319',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead presales conversations for Azure data and AI programs. Partner with delivery teams. Support solution design. Apply via the AES Technologies careers page.',
    },
  )
})

test('run fetches listing and detail pages, then decorates jobs for persistence', async () => {
  const requestedUrls = []
  const jobs = await createAesTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return listingsHtml
      if (url === 'https://careers.advanceecomsolutions.com/job-detail/319') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    'https://careers.advanceecomsolutions.com/job-detail/319',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aestechnologies')
  assert.equal(jobs[0].link, 'https://careers.advanceecomsolutions.com/apply-job/319')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('run returns no jobs when the current AES careers page exposes no job detail links', async () => {
  const jobs = await createAesTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREER_PAGE_URL)
      return currentNoDetailListingsHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('resolves root-relative listing and apply links against the site origin', () => {
  const [listing] = extractListings(listingsHtml)
  const detail = extractJobDetail(detailHtml, listing)

  assert.equal(listing.detailUrl, 'https://careers.advanceecomsolutions.com/job-detail/319')
  assert.equal(detail.applyUrl, 'https://careers.advanceecomsolutions.com/apply-job/319')
})
