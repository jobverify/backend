import assert from 'node:assert/strict'
import test from 'node:test'

const loadFirstsourceModule = async () => {
  try {
    return await import('../../scraper/firstsource/script.js')
  } catch {
    assert.fail('Expected Firstsource scraper module at ../../scraper/firstsource/script.js')
  }
}

const indiaListingPage1Html = `
<div class="searchResultsShell">
  <table id="searchresults" class="searchResults full table table-striped table-hover" cellpadding="0" cellspacing="0" aria-label="Search results for India. Page 1 of 2, Results 1 to 25 of 33">
    <tbody>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="https://careers.firstsource.com/job/Mumbai-Associate-Sr-Associate-Query-Management/24697744/">Associate / Sr Associate - Query Management</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Mumbai, Maharashtra, India</span>
        </td>
        <td class="colDate">
          <span class="jobDate">09 Jul 2026</span>
        </td>
      </tr>
      <tr class="data-row">
        <td class="colTitle">
          <a class="jobTitle-link" href="https://careers.firstsource.com/job/Derry-Customer-Support-Associate/24600000/">Customer Support Associate</a>
        </td>
        <td class="colLocation">
          <span class="jobLocation">Derry, Northern Ireland, United Kingdom</span>
        </td>
        <td class="colDate">
          <span class="jobDate">08 Jul 2026</span>
        </td>
      </tr>
    </tbody>
  </table>
  <a class="next" href="https://careers.firstsource.com/India/go/India-Jobs/655444/?startrow=25">Next</a>
</div>
`

const detailHtml = `
<html>
  <head>
    <meta itemprop="datePosted" content="2026-07-09" />
  </head>
  <body>
    <h1 itemprop="title">Associate / Sr Associate - Query Management</h1>
    <dl>
      <dt>Location(s):</dt>
      <dd>Mumbai, Maharashtra, India</dd>
      <dt>Requisition ID:</dt>
      <dd>8744</dd>
      <dt>Type of position:</dt>
      <dd>Full-Time</dd>
      <dt>Work experience:</dt>
      <dd>Entry Level</dd>
    </dl>
    <span itemprop="description">
      <p>Support customer query resolution for finance operations.</p>
      <ul>
        <li>Handle customer email tickets</li>
        <li>Coordinate with internal operations teams</li>
      </ul>
    </span>
    <a class="apply" href="https://careers.firstsource.com/talentcommunity/apply/24697744/?locale=en_US">Apply</a>
  </body>
</html>
`

test('Firstsource scraper keeps requests on the public India SuccessFactors board and excludes non-India rows', async () => {
  const {
    INDIA_SEARCH_URL,
    createFirstsourceScraper,
    extractJobDetail,
    extractPaginationSummary,
    extractSearchResults,
  } = await loadFirstsourceModule()

  assert.equal(
    INDIA_SEARCH_URL,
    'https://careers.firstsource.com/India/go/India-Jobs/655444/',
  )

  const listings = extractSearchResults(indiaListingPage1Html)
  assert.deepEqual(listings, [{
    title: 'Associate / Sr Associate - Query Management',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '24697744',
    requisitionId: '24697744',
    sourceUrl: 'https://careers.firstsource.com/job/Mumbai-Associate-Sr-Associate-Query-Management/24697744/',
    postingDate: '2026-07-09',
  }])

  assert.deepEqual(extractPaginationSummary(indiaListingPage1Html), {
    nextUrl: 'https://careers.firstsource.com/India/go/India-Jobs/655444/?startrow=25',
  })

  assert.deepEqual(extractJobDetail(detailHtml, listings[0]), {
    title: 'Associate / Sr Associate - Query Management',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '24697744',
    requisitionId: '8744',
    employmentType: 'Full-Time',
    experienceRequired: 'Entry Level',
    jobDescription: 'Support customer query resolution for finance operations. - Handle customer email tickets - Coordinate with internal operations teams',
    publicExperienceChecked: true,
    requiredSkills: [
      'Handle customer email tickets',
      'Coordinate with internal operations teams',
    ],
    postingDate: '2026-07-09',
    applyUrl: 'https://careers.firstsource.com/talentcommunity/apply/24697744/?locale=en_US',
    sourceUrl: 'https://careers.firstsource.com/job/Mumbai-Associate-Sr-Associate-Query-Management/24697744/',
  })

  const requestedUrls = []
  const jobs = await createFirstsourceScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === INDIA_SEARCH_URL) return indiaListingPage1Html
      if (url === listings[0].sourceUrl) return detailHtml
      throw new Error(`Unexpected Firstsource URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [INDIA_SEARCH_URL, listings[0].sourceUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Firstsource Solutions Limited')
  assert.equal(jobs[0].source, 'firstsource')
  assert.equal(jobs[0].requisitionId, '8744')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.firstsource.com/talentcommunity/apply/24697744/?locale=en_US',
  )
  assert.equal(jobs[0].publicExperienceChecked, true)
})
