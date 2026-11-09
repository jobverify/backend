import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIndiaSearchUrl,
  createAlstomScraper,
  extractJobDetail,
  extractResultsSummary,
  extractSearchResults,
} from './script.js'

const listingHtml = `
<span class="paginationLabel">Results 1 to 2 of 2</span>
<span class="srHelp">Page 1 of 1</span>
<table>
  <tr class="data-row">
    <td>
      <a class="jobTitle-link" href="/job/Bangalore-Senior-Engineer/123456789/">Senior Engineer</a>
      <span class="jobLocation">Bangalore, KA, IN</span>
    </td>
  </tr>
  <tr class="data-row">
    <td>
      <a class="jobTitle-link" href="/job/Nagpur-Maintenance-Engineer/987654321/">Maintenance Engineer</a>
      <span class="jobLocation">Nagpur, MH, IN</span>
    </td>
  </tr>
</table>
`

const detailHtml = `
<html>
  <body>
    <h1 itemprop="title">Senior Engineer</h1>
    <span itemprop="description">
      <p>Build modern rail software.</p>
      <ul>
        <li>Node.js</li>
        <li>Testing</li>
      </ul>
    </span>
    <meta itemprop="datePosted" content="2026-07-01" />
    <meta itemprop="validThrough" content="2026-07-31" />
    <meta itemprop="addressLocality" content="Bangalore" />
    <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/apply/123456789/?locale=en_GB">Apply</a>
  </body>
</html>
`

test('builds the India-filtered Alstom search URL and parses listing summaries', () => {
  assert.equal(
    buildIndiaSearchUrl(),
    'https://jobsearch.alstom.com/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_department=&optionsFacetsDD_shifttype=&locale=en_GB',
  )
  assert.equal(
    buildIndiaSearchUrl(25),
    'https://jobsearch.alstom.com/search/?createNewAlert=false&q=&locationsearch=India&optionsFacetsDD_country=&optionsFacetsDD_department=&optionsFacetsDD_shifttype=&locale=en_GB&startrow=25',
  )
  assert.deepEqual(extractResultsSummary(listingHtml), {
    totalResults: 2,
    currentPage: 1,
    totalPages: 1,
    pageSize: 2,
  })
})

test('extracts India search rows and job detail metadata from SuccessFactors markup', () => {
  const listings = extractSearchResults(listingHtml)

  assert.deepEqual(listings, [
    {
      title: 'Senior Engineer',
      location: 'Bangalore, KA, IN',
      city: 'Bangalore',
      jobId: '123456789',
      requisitionId: '123456789',
      sourceUrl: 'https://jobsearch.alstom.com/job/Bangalore-Senior-Engineer/123456789/',
      postingDate: null,
    },
    {
      title: 'Maintenance Engineer',
      location: 'Nagpur, MH, IN',
      city: 'Nagpur',
      jobId: '987654321',
      requisitionId: '987654321',
      sourceUrl: 'https://jobsearch.alstom.com/job/Nagpur-Maintenance-Engineer/987654321/',
      postingDate: null,
    },
  ])

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Senior Engineer',
    location: 'Bangalore, KA, IN',
    city: 'Bangalore',
    jobId: '123456789',
    requisitionId: '123456789',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Build modern rail software. - Node.js - Testing',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Node.js', 'Testing'],
    postingDate: '2026-07-01',
    closingDate: '2026-07-31',
    applyUrl: 'https://jobsearch.alstom.com/apply/123456789/?locale=en_GB',
    sourceUrl: 'https://jobsearch.alstom.com/job/Bangalore-Senior-Engineer/123456789/',
  })
})

test('run fetches the India search page and detail pages, returning Alstom jobs', async () => {
  const requests = []
  const scraper = createAlstomScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildIndiaSearchUrl()) return listingHtml
      if (url === 'https://jobsearch.alstom.com/job/Bangalore-Senior-Engineer/123456789/') {
        return detailHtml
      }
      if (url === 'https://jobsearch.alstom.com/job/Nagpur-Maintenance-Engineer/987654321/') {
        return detailHtml
          .replaceAll('Senior Engineer', 'Maintenance Engineer')
          .replaceAll('123456789', '987654321')
          .replaceAll('Bangalore, KA, IN', 'Nagpur, MH, IN')
          .replaceAll('Bangalore', 'Nagpur')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildIndiaSearchUrl(),
    'https://jobsearch.alstom.com/job/Bangalore-Senior-Engineer/123456789/',
    'https://jobsearch.alstom.com/job/Nagpur-Maintenance-Engineer/987654321/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Alstom')
  assert.equal(jobs[0].source, 'alstom')
  assert.equal(jobs[0].applyUrl, 'https://jobsearch.alstom.com/apply/123456789/?locale=en_GB')
  assert.equal(jobs[1].title, 'Maintenance Engineer')
  assert.equal(jobs[1].city, 'Nagpur')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})
