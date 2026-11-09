import assert from 'node:assert/strict'
import test from 'node:test'

const searchPageHtml = `
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
      <a class="btn btn-primary btn-large btn-lg apply dialogApplyBtn" href="/talentcommunity/apply/56703944/?locale=en_US">Apply now Â»</a>
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

const loadReNewModule = async () => {
  try {
    return await import('../../scraper/renew/script.js')
  } catch {
    assert.fail('Expected ReNew scraper module at ../../scraper/renew/script.js')
  }
}

test('ReNew exports a stable exact-name wrapper over the verified ReNew Power jobs contract', async () => {
  const reNew = await loadReNewModule()

  assert.equal(reNew.SOURCE, 'renew')
  assert.equal(reNew.COMPANY, 'ReNew')
  assert.equal(reNew.OFFICIAL_BRAND_NAME, 'ReNew Power')
  assert.equal(reNew.CAREERS_URL, 'https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081')
  assert.equal(reNew.COMPANY_DOMAIN, 'renew.com')
  assert.equal(reNew.ATS_PLATFORM, 'linkedin-employer-public-subset')
  assert.equal(reNew.COUNTRY_FILTER, 'India')
  assert.equal(reNew.PAGINATION_STRATEGY, 'counted-current-native-company-cards+stable-final-snapshot')
  assert.equal(reNew.VERIFIED_ON, '2026-10-09')
  assert.match(reNew.VERIFIED_SURFACE_SUMMARY, /ReNew Jobs/i)
  assert.equal(reNew.hasVerifiedReNewJobsPageSignal(searchPageHtml), true)
  assert.deepEqual(
    reNew.decorateReNewJob(
      {
        title: 'SAP FICO Lead',
        company: 'ReNew Power',
        source: 'renewpower',
        jobId: '56703944',
        link: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
        applyUrl: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
        sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
      },
      '2026-07-15T21:00:00.000Z',
    ),
    {
      title: 'SAP FICO Lead',
      company: 'ReNew',
      source: 'renew',
      jobId: '56703944',
      link: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
      applyUrl: 'https://careers.renew.com/talentcommunity/apply/56703944/?locale=en_US',
      sourceUrl: 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
      companyCareerPage: 'https://careers.renew.com/',
      companyDomain: 'careers.renew.com',
      atsPlatform: 'successfactors',
      scrapedAt: '2026-07-15T21:00:00.000Z',
    },
  )
})

test('ReNew run validates the jobs page and decorates jobs from the existing ReNew Power scraper', async () => {
  const reNew = await loadReNewModule()
  const requestedUrls = []

  const jobs = await reNew.createReNewScraper({
    maxPages: 1,
    now: () => '2026-07-15T21:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === reNew.buildSearchUrl()) return searchPageHtml
      if (url === 'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/') return activeDetailPageHtml
      if (url === 'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/') return filledDetailPageHtml

      throw new Error(`Unexpected ReNew URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    reNew.buildSearchUrl(),
    'https://careers.renew.com/job/Gurgaon-SAP-FICO-Lead-HR/56703944/',
    'https://careers.renew.com/job/Bhurai-In-Engineer-Cell-Process-GJ/55832444/',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'renew')
  assert.equal(jobs[0].company, 'ReNew')
  assert.equal(jobs[0].companyCareerPage, 'https://careers.renew.com/')
  assert.equal(jobs[0].companyDomain, 'careers.renew.com')
  assert.equal(jobs[0].atsPlatform, 'successfactors')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T21:00:00.000Z')
})

test('ReNew fails closed when the verified jobs page drifts materially', async () => {
  const reNew = await loadReNewModule()

  await assert.rejects(
    reNew.createReNewScraper().run({
      fetchText: async () => '<html><body>Unexpected page</body></html>',
    }),
    /verified ReNew jobs page/i,
  )
})
