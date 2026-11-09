import assert from 'node:assert/strict'
import test from 'node:test'

const loadChartIndustriesModule = async () => {
  try {
    return await import('../../scraper/chartindustries/script.js')
  } catch {
    assert.fail('Expected Chart Industries scraper module at ../../scraper/chartindustries/script.js')
  }
}

const listingHtml = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" cellpadding="0" cellspacing="0" aria-label="Search results for India. Page 1 of 2, Results 1 to 10 of 12">
    <tbody>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="https://jobs.chartindustries.com/job/Bengaluru-Controls-Engineer/1234567890/">Controls Engineer</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Bengaluru, Karnataka, India</span>
        </td>
        <td class="colDate">
          <span class="jobDate">09 Jul 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="https://jobs.chartindustries.com/job/Houston-Field-Service-Technician/2222222222/">Field Service Technician</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Houston, Texas, United States</span>
        </td>
        <td class="colDate">
          <span class="jobDate">08 Jul 2026</span>
        </td>
      </tr>
    </tbody>
  </table>
  <a class="next" href="https://jobs.chartindustries.com/search/?q=&locationsearch=India&startrow=10">Next</a>
</div>
`

const detailHtml = `
<html>
  <head>
    <meta itemprop="datePosted" content="2026-07-09" />
  </head>
  <body>
    <h1 itemprop="title">Controls Engineer</h1>
    <dl>
      <dt>Location(s):</dt>
      <dd>Bengaluru, Karnataka, India</dd>
      <dt>Job ID:</dt>
      <dd>1234567890</dd>
      <dt>Type of position:</dt>
      <dd>Full-Time</dd>
    </dl>
    <span itemprop="description">
      <p>Build and maintain cryogenic controls systems.</p>
      <ul>
        <li>Develop PLC logic</li>
        <li>Support commissioning activities</li>
      </ul>
    </span>
    <a class="apply" href="https://jobs.chartindustries.com/talentcommunity/apply/1234567890/?locale=en_US">Apply</a>
  </body>
</html>
`

test('Chart Industries scraper stays on the official India SuccessFactors pages and normalizes shared fields', async () => {
  const {
    INDIA_SEARCH_URL,
    buildSearchUrl,
    createChartIndustriesScraper,
    extractJobDetail,
    extractPaginationSummary,
    extractSearchResults,
  } = await loadChartIndustriesModule()

  assert.equal(
    INDIA_SEARCH_URL,
    'https://jobs.chartindustries.com/search/?q=&locationsearch=India',
  )
  assert.equal(
    buildSearchUrl(),
    'https://jobs.chartindustries.com/search/?q=&locationsearch=India',
  )
  assert.equal(
    buildSearchUrl({ startRow: 10 }),
    'https://jobs.chartindustries.com/search/?q=&locationsearch=India&startrow=10',
  )

  const listings = extractSearchResults(listingHtml)
  assert.deepEqual(listings, [{
    title: 'Controls Engineer',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '1234567890',
    requisitionId: '1234567890',
    sourceUrl: 'https://jobs.chartindustries.com/job/Bengaluru-Controls-Engineer/1234567890/',
    postingDate: '2026-07-09',
  }])

  assert.deepEqual(extractPaginationSummary(listingHtml), {
    nextUrl: 'https://jobs.chartindustries.com/search/?q=&locationsearch=India&startrow=10',
    pageSize: 10,
    totalJobCount: 12,
  })

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Controls Engineer',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '1234567890',
    requisitionId: '1234567890',
    employmentType: 'Full-Time',
    experienceRequired: null,
    jobDescription: 'Build and maintain cryogenic controls systems. - Develop PLC logic - Support commissioning activities',
    requiredSkills: [
      'Develop PLC logic',
      'Support commissioning activities',
    ],
    postingDate: '2026-07-09',
    applyUrl: 'https://jobs.chartindustries.com/talentcommunity/apply/1234567890/?locale=en_US',
    sourceUrl: 'https://jobs.chartindustries.com/job/Bengaluru-Controls-Engineer/1234567890/',
  })

  const requestedUrls = []
  const jobs = await createChartIndustriesScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === INDIA_SEARCH_URL) return listingHtml
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected Chart Industries URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [INDIA_SEARCH_URL, listings[0].sourceUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Chart Industries')
  assert.equal(jobs[0].source, 'chartindustries')
  assert.equal(
    jobs[0].applyUrl,
    'https://jobs.chartindustries.com/talentcommunity/apply/1234567890/?locale=en_US',
  )
})
