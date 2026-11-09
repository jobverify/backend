import assert from 'node:assert/strict'
import test from 'node:test'

const loadTataPowerModule = async () => {
  try {
    return await import('../../scraper/tatapower/script.js')
  } catch {
    assert.fail('Expected Tata Power scraper module at ../../scraper/tatapower/script.js')
  }
}

const searchPage1Html = `
<!doctype html>
<html>
  <body>
    <h1>Jobs at Tata Power</h1>
    <div class="pagination-label-row">
      <span class="paginationLabel" aria-label="Results 1 to 2">Results <b>1 to 2</b> of <b>2</b></span>
      <span class="srHelp">Page 1 of 1</span>
    </div>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/" class="jobTitle-link">Manager - Grid Strategy</a>
            </span>
            <span class="jobTitle visible-phone">
              <a href="/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/" class="jobTitle-link">Manager - Grid Strategy</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Digital &amp; IT</span></td>
          <td class="colLocation"><span class="jobLocation">Mumbai, Maharashtra, India</span></td>
          <td class="colDate"><span class="jobDate">Jul 10, 2026</span></td>
        </tr>
        <tr class="data-row">
          <td class="colTitle">
            <span class="jobTitle hidden-phone">
              <a href="/job/Bengaluru-Senior-Engineer-Solar-Analytics-KA/1410001001/" class="jobTitle-link">Senior Engineer - Solar Analytics</a>
            </span>
          </td>
          <td class="colDepartment"><span class="jobDepartment">Solar Manufacturing</span></td>
          <td class="colLocation"><span class="jobLocation">Bengaluru, Karnataka, India</span></td>
          <td class="colDate"><span class="jobDate">Jul 9, 2026</span></td>
        </tr>
      </tbody>
    </table>
    <p>Tata Power. All Rights Reserved.</p>
  </body>
</html>
`

const searchTilePageHtml = `
<!doctype html>
<html>
  <head>
    <title>tatapower Jobs</title>
  </head>
  <body>
    <div class="job-tile-result-container">
      <span id="tile-search-results-label">Showing 1 Job</span>
      <label id="searchresultslabel">Search results for "". Showing 1 Job</label>
      <ul id="job-tile-list" class="container job-list" data-per-page="25" data-record-returned="1">
        <li class="job-tile job-id-58881244" data-url="/job/TATA-POWER%2C-CENTEC-Lead-Engineer-0-0/58881244/">
          <div class="tiletitle">
            <a class="jobTitle-link" href="/job/TATA-POWER%2C-CENTEC-Lead-Engineer-0-0/58881244/">Lead Engineer</a>
          </div>
          <div id="job-58881244-desktop-section-dept-value">D&amp;IT Services (T&amp;D)</div>
          <div id="job-58881244-desktop-section-customfield1-value">Odisha</div>
          <div id="job-58881244-desktop-section-customfield2-value">Experienced</div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const searchEmptyPageHtml = `
<!doctype html>
<html>
  <head>
    <title>tatapower Jobs</title>
  </head>
  <body>
    <div id="content">
      <label id="searchresultslabel">Search results for "".</label>
      <div id="noresults">
        <img id="attention-img" src="/platform/images/attention.png" alt="Attention!" border="0" />
        <label>There are currently no open positions matching "<span class='attention securitySearchString'></span>".</label>
      </div>
      <div id="noresults-message">
        <label>The 0 most recent jobs posted by tatapower are listed below for your convenience.</label>
      </div>
    </div>
  </body>
</html>
`

const detailPage1Html = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <p id="job-location"><span class="jobGeoLocation">Mumbai, Maharashtra, India</span></p>
      <meta itemprop="datePosted" content="2026-07-10" />
      <meta itemprop="validThrough" content="2026-07-25" />
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1410001000/?locale=en_GB">Apply now</a>
      </div>
      <h1>
        <span itemprop="title" data-careersite-propertyid="title">Manager - Grid Strategy</span>
      </h1>
      <span data-careersite-propertyid="department">Digital &amp; IT</span>
      <span data-careersite-propertyid="shifttype">Full-time</span>
      <span itemprop="description" data-careersite-propertyid="description">
        <span class="jobdescription">
          <p>Lead grid strategy planning for next-generation clean energy operations.</p>
          <ul>
            <li>Power systems modeling</li>
            <li>Cross-functional stakeholder management</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

const detailPage2Html = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <p id="job-location"><span class="jobGeoLocation">Bengaluru, Karnataka, India</span></p>
      <meta itemprop="datePosted" content="2026-07-09" />
      <div class="applylink pull-right">
        <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/1410001001/?locale=en_US">Apply now</a>
      </div>
      <h1>
        <span itemprop="title" data-careersite-propertyid="title">Senior Engineer - Solar Analytics</span>
      </h1>
      <span data-careersite-propertyid="department">Solar Manufacturing</span>
      <span itemprop="description" data-careersite-propertyid="description">
        <span class="jobdescription">
          <p>Build analytics workflows for solar manufacturing quality and yield.</p>
        </span>
      </span>
    </div>
  </body>
</html>
`

const detailPageCurrentHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place">
        <span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
          <meta itemprop="addressLocality" content="TATA POWER, CENTEC">
          <meta itemprop="addressRegion" content="0">
          <meta itemprop="postalCode" content="0">
          <meta itemprop="addressCountry" content="In">
        </span>
      </span>
      <meta itemprop="datePosted" content="Fri Aug 14 00:00:00 UTC 2026">
      <meta itemprop="validThrough" content="Fri Aug 14 18:30:00 UTC 2026">
      <div class="jobTitle">
        <h1 id="job-title" itemprop="title">Lead Engineer</h1>
        <div class="applylink pull-right">
          <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn " href="/talentcommunity/apply/58881244/?locale=en_US">Apply now</a>
        </div>
      </div>
      <p id="job-location"><span class="jobGeoLocation">TATA POWER, CENTEC, 0, India, 0</span></p>
      <span data-careersite-propertyid="department">D&amp;IT Services (T&amp;D)</span>
      <span itemprop="description" class="jobdescription">
        <p><strong><em><span>Role: Jr Full Stack Engineer</span></em></strong></p>
        <p><strong><em><span>Location: Bhubaneshwar</span></em></strong></p>
        <p>Build internal digital platforms for Tata Power.</p>
      </span>
    </div>
  </body>
</html>
`

test('buildSearchUrl stays pinned to the official Tata Power public jobs2web route', async () => {
  const { buildSearchUrl } = await loadTataPowerModule()

  assert.equal(
    buildSearchUrl(),
    'https://careers.tatapower.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield2=&optionsFacetsDD_dept=&q=',
  )
  assert.equal(
    buildSearchUrl(25),
    'https://careers.tatapower.com/search/?createNewAlert=false&locationsearch=&optionsFacetsDD_customfield1=&optionsFacetsDD_customfield2=&optionsFacetsDD_dept=&q=&startrow=25',
  )
})

test('extractSearchResults parses Tata Power search rows from the official jobs2web surface', async () => {
  const { extractSearchResults, hasOfficialSearchResultsSignal } = await loadTataPowerModule()

  assert.equal(hasOfficialSearchResultsSignal(searchPage1Html), true)
  assert.deepEqual(extractSearchResults(searchPage1Html), [
    {
      title: 'Manager - Grid Strategy',
      department: 'Digital & IT',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      jobId: '1410001000',
      requisitionId: '1410001000',
      sourceUrl: 'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/',
      postingDate: 'Jul 10, 2026',
    },
    {
      title: 'Senior Engineer - Solar Analytics',
      department: 'Solar Manufacturing',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: '1410001001',
      requisitionId: '1410001001',
      sourceUrl: 'https://careers.tatapower.com/job/Bengaluru-Senior-Engineer-Solar-Analytics-KA/1410001001/',
      postingDate: 'Jul 9, 2026',
    },
  ])
})

test('extractSearchResults parses Tata Power job tiles from the current jobs2web surface', async () => {
  const { extractSearchResults, hasOfficialSearchResultsSignal } = await loadTataPowerModule()

  assert.equal(hasOfficialSearchResultsSignal(searchTilePageHtml), true)
  assert.deepEqual(extractSearchResults(searchTilePageHtml), [
    {
      title: 'Lead Engineer',
      department: 'D&IT Services (T&D)',
      location: 'Odisha, India',
      city: null,
      jobId: '58881244',
      requisitionId: '58881244',
      sourceUrl: 'https://careers.tatapower.com/job/TATA-POWER%2C-CENTEC-Lead-Engineer-0-0/58881244/',
      postingDate: null,
    },
  ])
})

test('extractResultsSummary reads Tata Power result counts from pagination chrome', async () => {
  const { extractResultsSummary } = await loadTataPowerModule()

  assert.deepEqual(extractResultsSummary(searchPage1Html), {
    totalResults: 2,
    currentPage: 1,
    totalPages: 1,
    pageSize: 2,
  })
})

test('extractResultsSummary reads Tata Power tile counts from the current card layout', async () => {
  const { extractResultsSummary } = await loadTataPowerModule()

  assert.deepEqual(extractResultsSummary(searchTilePageHtml), {
    totalResults: 1,
    currentPage: null,
    totalPages: 1,
    pageSize: 1,
  })
})

test('hasOfficialEmptyStateSignal recognizes the current Tata Power empty jobs shell', async () => {
  const { hasOfficialEmptyStateSignal, extractSearchResults } = await loadTataPowerModule()

  assert.equal(hasOfficialEmptyStateSignal(searchEmptyPageHtml), true)
  assert.deepEqual(extractSearchResults(searchEmptyPageHtml), [])
})

test('extractJobDetail reads Tata Power detail metadata and apply URLs from the official job page', async () => {
  const { extractJobDetail } = await loadTataPowerModule()
  const detail = extractJobDetail(detailPage1Html, {
    title: 'Manager - Grid Strategy',
    department: 'Digital & IT',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '1410001000',
    requisitionId: '1410001000',
    sourceUrl: 'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/',
    postingDate: 'Jul 10, 2026',
  })

  assert.deepEqual(detail, {
    title: 'Manager - Grid Strategy',
    department: 'Digital & IT',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '1410001000',
    requisitionId: '1410001000',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Lead grid strategy planning for next-generation clean energy operations. - Power systems modeling - Cross-functional stakeholder management',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Power systems modeling',
      'Cross-functional stakeholder management',
    ],
    postingDate: '2026-07-10',
    closingDate: '2026-07-25',
    applyUrl: 'https://careers.tatapower.com/talentcommunity/apply/1410001000/?locale=en_GB',
    sourceUrl: 'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/',
  })
})

test('extractJobDetail prefers the current description location hint over placeholder Tata Power site metadata', async () => {
  const { extractJobDetail } = await loadTataPowerModule()
  const detail = extractJobDetail(detailPageCurrentHtml, {
    title: 'Lead Engineer',
    department: 'D&IT Services (T&D)',
    location: 'Odisha, India',
    city: null,
    jobId: '58881244',
    requisitionId: '58881244',
    sourceUrl: 'https://careers.tatapower.com/job/TATA-POWER%2C-CENTEC-Lead-Engineer-0-0/58881244/',
    postingDate: null,
  })

  assert.equal(detail.location, 'Bhubaneshwar, Odisha, India')
  assert.equal(detail.city, 'Bhubaneshwar')
  assert.equal(detail.applyUrl, 'https://careers.tatapower.com/talentcommunity/apply/58881244/?locale=en_US')
})

test('run validates the official Tata Power search page and decorates parsed jobs', async () => {
  const tataPower = await loadTataPowerModule()
  const requestedUrls = []

  const jobs = await tataPower.createTataPowerScraper().run({
    maxPages: 1,
    maxJobs: 2,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === tataPower.buildSearchUrl()) return searchPage1Html
      if (url === 'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/') {
        return detailPage1Html
      }
      if (url === 'https://careers.tatapower.com/job/Bengaluru-Senior-Engineer-Solar-Analytics-KA/1410001001/') {
        return detailPage2Html
      }

      throw new Error(`Unexpected Tata Power URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    tataPower.buildSearchUrl(),
    'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/',
    'https://careers.tatapower.com/job/Bengaluru-Senior-Engineer-Solar-Analytics-KA/1410001001/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    jobId: '1410001000',
    requisitionId: '1410001000',
    title: 'Manager - Grid Strategy',
    company: 'Tata Power',
    department: 'Digital & IT',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    link: 'https://careers.tatapower.com/talentcommunity/apply/1410001000/?locale=en_GB',
    applyUrl: 'https://careers.tatapower.com/talentcommunity/apply/1410001000/?locale=en_GB',
    sourceUrl: 'https://careers.tatapower.com/job/Mumbai-Manager-Grid-Strategy-MH/1410001000/',
    source: 'tatapower',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Lead grid strategy planning for next-generation clean energy operations. - Power systems modeling - Cross-functional stakeholder management',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Power systems modeling',
      'Cross-functional stakeholder management',
    ],
    postingDate: '2026-07-10',
    closingDate: '2026-07-25',
    scrapedAt: '2026-07-10T00:00:00.000Z',
  })
  assert.equal(jobs[1].company, 'Tata Power')
  assert.equal(jobs[1].source, 'tatapower')
  assert.equal(jobs[1].scrapedAt, '2026-07-10T00:00:00.000Z')
})

test('run returns an empty list when the official Tata Power board has no open positions', async () => {
  const tataPower = await loadTataPowerModule()

  const jobs = await tataPower.createTataPowerScraper().run({
    fetchText: async () => searchEmptyPageHtml,
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the Tata Power official search signal disappears', async () => {
  const { createTataPowerScraper } = await loadTataPowerModule()

  await assert.rejects(
    createTataPowerScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official Tata Power jobs page/i,
  )
})
