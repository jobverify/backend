import assert from 'node:assert/strict'
import test from 'node:test'

const loadIngersollRandModule = async () => {
  try {
    return await import('../../scraper/ingersollrand/script.js')
  } catch {
    assert.fail('Expected Ingersoll Rand scraper module at ../../scraper/ingersollrand/script.js')
  }
}

const indiaListingPage1Html = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" cellpadding="0" cellspacing="0" aria-label="Search results for Middle East, India and Africa. Page 1 of 4, Results 1 to 25 of 76">
    <tbody>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Bangalore-JDE-Applications-Developer-%28Finance%29-KA-560-029/1389697800/">JDE Applications Developer (Finance)</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Bangalore, KA, IN</span>
        </td>
        <td class="colDate">
          <span class="jobDate">09 Jul 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="/job/Dubai-Business-Analyst/1380000000/">Business Analyst</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Dubai, DU, AE</span>
        </td>
        <td class="colDate">
          <span class="jobDate">08 Jul 2026</span>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`

const detailHtml = `
<html>
  <head>
    <meta itemprop="datePosted" content="2026-07-09" />
  </head>
  <body>
    <h1 itemprop="title">JDE Applications Developer (Finance)</h1>
    <dl>
      <dt>Location(s):</dt>
      <dd>Bangalore, Karnataka, India</dd>
      <dt>Requisition ID:</dt>
      <dd>REQ-44821</dd>
      <dt>Type of position:</dt>
      <dd>Full-time</dd>
      <dt>Work experience:</dt>
      <dd>Mid Level</dd>
    </dl>
    <span itemprop="description">
      <p>Build finance integrations across JDE systems.</p>
      <ul>
        <li>Support JDE workflows</li>
        <li>Partner with ERP teams</li>
      </ul>
    </span>
    <a class="apply" href="https://careers.irco.com/talentcommunity/apply/1389697800/?locale=en_US">Apply</a>
  </body>
</html>
`

test('Ingersoll Rand scraper keeps requests on the public MEIA SuccessFactors board and excludes non-India rows', async () => {
  const {
    INDIA_SEARCH_URL,
    buildApplyUrl,
    buildSearchUrl,
    createIngersollRandScraper,
    extractJobDetail,
    extractPaginationSummary,
    extractSearchResults,
  } = await loadIngersollRandModule()

  assert.equal(
    INDIA_SEARCH_URL,
    'https://careers.irco.com/go/Middle-East%2C-India-and-Africa/9515600/',
  )
  assert.equal(
    buildSearchUrl(),
    'https://careers.irco.com/go/Middle-East%2C-India-and-Africa/9515600/?q=&sortColumn=referencedate&sortDirection=desc',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://careers.irco.com/go/Middle-East%2C-India-and-Africa/9515600/25/?q=&sortColumn=referencedate&sortDirection=desc',
  )
  assert.equal(
    buildApplyUrl('1389697800'),
    'https://careers.irco.com/talentcommunity/apply/1389697800/?locale=en_US',
  )

  const listings = extractSearchResults(indiaListingPage1Html)
  assert.deepEqual(listings, [{
    title: 'JDE Applications Developer (Finance)',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '1389697800',
    requisitionId: '1389697800',
    sourceUrl: 'https://careers.irco.com/job/Bangalore-JDE-Applications-Developer-%28Finance%29-KA-560-029/1389697800/',
    postingDate: '2026-07-09',
  }])

  assert.deepEqual(extractPaginationSummary(indiaListingPage1Html), {
    hasNext: true,
    currentPage: 1,
    totalPages: 4,
    totalJobCount: 76,
  })

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'JDE Applications Developer (Finance)',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    jobId: '1389697800',
    requisitionId: 'REQ-44821',
    employmentType: 'Full-time',
    experienceRequired: 'Mid Level',
    jobDescription: 'Build finance integrations across JDE systems. Support JDE workflows Partner with ERP teams',
    requiredSkills: [
      'Support JDE workflows',
      'Partner with ERP teams',
    ],
    postingDate: '2026-07-09',
    applyUrl: 'https://careers.irco.com/talentcommunity/apply/1389697800/?locale=en_US',
    sourceUrl: 'https://careers.irco.com/job/Bangalore-JDE-Applications-Developer-%28Finance%29-KA-560-029/1389697800/',
  })

  const requestedUrls = []
  const jobs = await createIngersollRandScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === INDIA_SEARCH_URL) return indiaListingPage1Html
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected Ingersoll Rand URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [INDIA_SEARCH_URL, listings[0].sourceUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Ingersoll Rand')
  assert.equal(jobs[0].source, 'ingersollrand')
  assert.equal(jobs[0].requisitionId, 'REQ-44821')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.irco.com/talentcommunity/apply/1389697800/?locale=en_US',
  )
})
