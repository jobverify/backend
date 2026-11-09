import assert from 'node:assert/strict'
import test from 'node:test'

const loadOlamModule = async () => {
  try {
    return await import('../../scraper/olam/script.js')
  } catch {
    assert.fail('Expected Olam scraper module at ../../scraper/olam/script.js')
  }
}

const searchPageHtml = `
<!doctype html>
<html>
  <body>
    <h1>Olam International Limited Jobs</h1>
    <div class="pagination-label-row">
      <span class="paginationLabel" aria-label="Results 1 – 20">Results <b>1 – 20</b> of <b>20</b></span>
      <span class="srHelp">Page 1 of 1</span>
    </div>
    <table id="searchresults" class="searchResults full table table-striped table-hover">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <a href="/job/Chennai-GBSoff-General-Manager-Consolidation-&amp;-Financial-Reporting/1332302466/" class="jobTitle-link">General Manager - Consolidation &amp; Financial Reporting</a>
          </td>
          <td class="colLocation">
            <span class="jobLocation"><span>Chennai-GBSoff, IN</span></span>
          </td>
          <td class="colDate">
            <span class="jobDate">4 Jul 2026</span>
          </td>
        </tr>
        <tr class="data-row">
          <td class="colTitle">
            <a href="/job/Iganmu-CategoryBrand-Manager/1440000001/" class="jobTitle-link">Category/Brand Manager</a>
          </td>
          <td class="colLocation">
            <span class="jobLocation">Iganmu, NG</span>
          </td>
          <td class="colDate">
            <span class="jobDate">11 Jun 2026</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p>Olam Employees</p>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <meta itemprop="datePosted" content="Sat Jul 04 16:00:00 UTC 2026" />
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1332302466/?locale=en_GB">Apply</a>
      </div>
      <h1>
        <span itemprop="title" data-careersite-propertyid="title">General Manager - Consolidation &amp; Financial Reporting</span>
      </h1>
      <span itemprop="description" data-careersite-propertyid="description">
        <span class="jobdescription">
          <p>Olam Agri is building stronger finance operations for a global food and agri-business.</p>
          <ul>
            <li>Own group consolidation reporting</li>
            <li>Partner with controllership stakeholders</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchUrl stays pinned to the verified public Olam SuccessFactors search route', async () => {
  const {
    SEARCH_PAGE_URL,
    buildSearchUrl,
  } = await loadOlamModule()

  assert.equal(
    SEARCH_PAGE_URL,
    'https://careers.olamgroup.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield3=&q=',
  )
  assert.equal(
    buildSearchUrl(),
    'https://careers.olamgroup.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield3=&q=',
  )
  assert.equal(
    buildSearchUrl({ startRow: 20 }),
    'https://careers.olamgroup.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield3=&q=&startrow=20',
  )
})

test('extractSearchResults keeps only India rows from the public Olam search table', async () => {
  const {
    extractSearchResults,
    hasOfficialSearchResultsSignal,
  } = await loadOlamModule()

  assert.equal(hasOfficialSearchResultsSignal(searchPageHtml), true)
  assert.deepEqual(extractSearchResults(searchPageHtml), [{
    title: 'General Manager - Consolidation & Financial Reporting',
    location: 'Chennai-GBSoff, India',
    city: 'Chennai-GBSoff',
    jobId: '1332302466',
    requisitionId: null,
    sourceUrl: 'https://careers.olamgroup.com/job/Chennai-GBSoff-General-Manager-Consolidation-&-Financial-Reporting/1332302466/',
    postingDate: '2026-07-04',
  }])
})

test('extractResultsSummary reads Olam pagination totals from the public search chrome', async () => {
  const { extractResultsSummary } = await loadOlamModule()

  assert.deepEqual(extractResultsSummary(searchPageHtml), {
    totalResults: 20,
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
  })
})

test('extractJobDetail falls back to the listing location and builds the public Olam apply handoff', async () => {
  const {
    buildApplyUrl,
    extractJobDetail,
  } = await loadOlamModule()

  assert.equal(
    buildApplyUrl('1332302466'),
    'https://careers.olamgroup.com/talentcommunity/apply/1332302466/?locale=en_GB',
  )

  assert.deepEqual(
    extractJobDetail(detailPageHtml, {
      title: 'General Manager - Consolidation & Financial Reporting',
      location: 'Chennai-GBSoff, India',
      city: 'Chennai-GBSoff',
      jobId: '1332302466',
      requisitionId: null,
      sourceUrl: 'https://careers.olamgroup.com/job/Chennai-GBSoff-General-Manager-Consolidation-&-Financial-Reporting/1332302466/',
      postingDate: '2026-07-04',
    }),
    {
      title: 'General Manager - Consolidation & Financial Reporting',
      location: 'Chennai-GBSoff, India',
      city: 'Chennai-GBSoff',
      jobId: '1332302466',
      requisitionId: null,
      employmentType: null,
      experienceRequired: null,
      jobDescription:
        'Olam Agri is building stronger finance operations for a global food and agri-business. - Own group consolidation reporting - Partner with controllership stakeholders',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Own group consolidation reporting',
        'Partner with controllership stakeholders',
      ],
      postingDate: '2026-07-04',
      closingDate: null,
      applyUrl: 'https://careers.olamgroup.com/talentcommunity/apply/1332302466/?locale=en_GB',
      sourceUrl: 'https://careers.olamgroup.com/job/Chennai-GBSoff-General-Manager-Consolidation-&-Financial-Reporting/1332302466/',
      department: null,
    },
  )
})

test('run validates the official Olam search page and decorates parsed India jobs', async () => {
  const {
    SEARCH_PAGE_URL,
    createOlamScraper,
  } = await loadOlamModule()

  const requests = []
  const jobs = await createOlamScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requests.push(url)
      if (url === SEARCH_PAGE_URL) return searchPageHtml
      if (url === 'https://careers.olamgroup.com/job/Chennai-GBSoff-General-Manager-Consolidation-&-Financial-Reporting/1332302466/') {
        return detailPageHtml
      }

      throw new Error(`Unexpected Olam URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    SEARCH_PAGE_URL,
    'https://careers.olamgroup.com/job/Chennai-GBSoff-General-Manager-Consolidation-&-Financial-Reporting/1332302466/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Olam')
  assert.equal(jobs[0].source, 'olam')
  assert.equal(jobs[0].jobId, '1332302466')
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.olamgroup.com/talentcommunity/apply/1332302466/?locale=en_GB',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('run fails closed when the verified public Olam search signal disappears', async () => {
  const { createOlamScraper } = await loadOlamModule()

  await assert.rejects(
    createOlamScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Olam jobs page/i,
  )
})
