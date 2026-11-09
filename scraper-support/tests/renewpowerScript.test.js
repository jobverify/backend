import assert from 'node:assert/strict'
import test from 'node:test'

const loadRenewPowerModule = async () => {
  try {
    return await import('../../scraper/renewpower/script.js')
  } catch {
    assert.fail('Expected ReNew Power scraper module at ../../scraper/renewpower/script.js')
  }
}

const searchPage1Html = `
<!doctype html>
<html>
  <body>
    <h1>Search results for "".</h1>
    <span class="paginationLabel">Showing 1 to 2 of 2 Jobs</span>
    <span class="srHelp">Page 1 of 1</span>
    <table id="searchresults">
      <tbody>
        <tr class="data-row">
          <td class="colTitle">
            <a href="/job/Gurgaon-SAP-FICO-Lead-HR/56703944/" class="jobTitle-link">SAP FICO Lead</a>
          </td>
          <td class="colLocation">
            <span class="jobLocation">Gurgaon, HR, IN</span>
          </td>
          <td class="colDepartment">
            <span class="jobDepartment">Digital</span>
          </td>
          <td class="colDate">
            <span class="jobDate">Jun 8, 2026</span>
          </td>
        </tr>
        <tr class="data-row">
          <td class="colTitle">
            <a href="/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/" class="jobTitle-link">Engineer - Cell Process</a>
          </td>
          <td class="colLocation">
            <span class="jobLocation">Bhurai, GJ, IN</span>
          </td>
          <td class="colDepartment">
            <span class="jobDepartment">Process</span>
          </td>
          <td class="colDate">
            <span class="jobDate">May 10, 2026</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p>ReNew Jobs</p>
  </body>
</html>
`

const activeDetailPageHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <h1><span itemprop="title">SAP FICO Lead</span></h1>
      <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn" href="/talentcommunity/apply/56703944/?locale=en_US">Apply now »</a>
      <p>Location: Gurgaon, HR, IN</p>
      <p>Company: ReNew</p>
      <meta itemprop="datePosted" content="2026-06-08" />
      <meta itemprop="validThrough" content="2026-07-31" />
      <span class="jobGeoLocation">Gurgaon, HR, IN</span>
      <span data-careersite-propertyid="department">Digital</span>
      <span data-careersite-propertyid="shifttype">Full time</span>
      <span itemprop="description">
        <span class="jobdescription">
          <p>Role- SAP FICO Lead</p>
          <p>Experience range: 10 years to 12 years</p>
          <ul>
            <li>Lead SAP FICO configuration</li>
            <li>Support finance transformation initiatives</li>
          </ul>
        </span>
      </span>
    </div>
  </body>
</html>
`

const filledDetailPageHtml = `
<!doctype html>
<html>
  <body>
    <div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting">
      <h1><span itemprop="title">Engineer - Cell Process</span></h1>
      <p>Date: May 10, 2026</p>
      <p>Company: ReNew</p>
      <p>Sorry, this position has been filled.</p>
    </div>
  </body>
</html>
`

test('buildSearchUrl stays pinned to the verified ReNew public jobs route', async () => {
  const { buildSearchUrl } = await loadRenewPowerModule()

  assert.equal(
    buildSearchUrl(),
    'https://careers.renew.com/search/?createNewAlert=false&q=&locationsearch=',
  )
  assert.equal(
    buildSearchUrl(10),
    'https://careers.renew.com/search/?createNewAlert=false&q=&locationsearch=&startrow=10',
  )
})

test('extractSearchResults parses ReNew search rows from the official careers site', async () => {
  const { extractSearchResults, hasOfficialSearchResultsSignal } = await loadRenewPowerModule()

  assert.equal(hasOfficialSearchResultsSignal(searchPage1Html), true)
  assert.deepEqual(extractSearchResults(searchPage1Html), [
    {
      title: 'SAP FICO Lead',
      department: 'Digital',
      location: 'Gurgaon, HR, IN',
      city: 'Gurgaon',
      jobId: '56703944',
      requisitionId: '56703944',
      sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
      postingDate: 'Jun 8, 2026',
    },
    {
      title: 'Engineer - Cell Process',
      department: 'Process',
      location: 'Bhurai, GJ, IN',
      city: 'Bhurai',
      jobId: '55832444',
      requisitionId: '55832444',
      sourceUrl: 'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/',
      postingDate: 'May 10, 2026',
    },
  ])
})

test('extractResultsSummary reads ReNew result counts from pagination chrome', async () => {
  const { extractResultsSummary } = await loadRenewPowerModule()

  assert.deepEqual(extractResultsSummary(searchPage1Html), {
    totalResults: 2,
    currentPage: 1,
    totalPages: 1,
    pageSize: 2,
  })
})

test('extractJobDetail reads ReNew detail metadata and detects filled roles', async () => {
  const { extractJobDetail } = await loadRenewPowerModule()

  assert.deepEqual(
    extractJobDetail(activeDetailPageHtml, {
      title: 'SAP FICO Lead',
      department: 'Digital',
      location: 'Gurgaon, HR, IN',
      city: 'Gurgaon',
      jobId: '56703944',
      requisitionId: '56703944',
      sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
      postingDate: 'Jun 8, 2026',
    }),
    {
      title: 'SAP FICO Lead',
      department: 'Digital',
      location: 'Gurgaon, HR, IN',
      city: 'Gurgaon',
      jobId: '56703944',
      requisitionId: '56703944',
      employmentType: 'Full time',
      experienceRequired: '10 years to 12 years',
      jobDescription: 'Role- SAP FICO Lead Experience range: 10 years to 12 years - Lead SAP FICO configuration - Support finance transformation initiatives',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Lead SAP FICO configuration',
        'Support finance transformation initiatives',
      ],
      postingDate: '2026-06-08',
      closingDate: '2026-07-31',
      applyUrl: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
      sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
      isFilled: false,
    },
  )

  assert.equal(
    extractJobDetail(filledDetailPageHtml, {
      title: 'Engineer - Cell Process',
      department: 'Process',
      location: 'Bhurai, GJ, IN',
      city: 'Bhurai',
      jobId: '55832444',
      requisitionId: '55832444',
      sourceUrl: 'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/',
      postingDate: 'May 10, 2026',
    }).isFilled,
    true,
  )
})

test('run validates the official ReNew search page, decorates active jobs, and skips filled roles', async () => {
  const renewPower = await loadRenewPowerModule()
  const requestedUrls = []

  const jobs = await renewPower.createRenewPowerScraper().run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === renewPower.buildSearchUrl()) return searchPage1Html
      if (url === 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/') return activeDetailPageHtml
      if (url === 'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/') return filledDetailPageHtml

      throw new Error(`Unexpected ReNew URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    renewPower.buildSearchUrl(),
    'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
    'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    jobId: '56703944',
    requisitionId: '56703944',
    title: 'SAP FICO Lead',
    company: 'ReNew Power',
    department: 'Digital',
    location: 'Gurgaon, HR, IN',
    city: 'Gurgaon',
    link: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
    applyUrl: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
    sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
    source: 'renewpower',
    employmentType: 'Full time',
    experienceRequired: '10 years to 12 years',
    jobDescription: 'Role- SAP FICO Lead Experience range: 10 years to 12 years - Lead SAP FICO configuration - Support finance transformation initiatives',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Lead SAP FICO configuration',
      'Support finance transformation initiatives',
    ],
    postingDate: '2026-06-08',
    closingDate: '2026-07-31',
    scrapedAt: '2026-07-11T00:00:00.000Z',
  })
})

test('run fails closed when the ReNew official search signal disappears', async () => {
  const { createRenewPowerScraper } = await loadRenewPowerModule()

  await assert.rejects(
    createRenewPowerScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /official ReNew jobs page/i,
  )
})
