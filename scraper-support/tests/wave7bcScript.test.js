import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const avasoListingPage1Html = `
<!doctype html>
<html lang="en">
  <body>
    <h1 class="keyword-title">Search results for "".</h1>
    <div class="paginationShell">
      <span class="paginationLabel">Results <b>1 – 25</b> of <b>27</b></span>
      <span class="srHelp">Page 1 of 2</span>
      <ul class="pagination">
        <li><a href="?q=&sortColumn=referencedate&sortDirection=desc&startrow=25" title="Page 2">2</a></li>
      </ul>
    </div>
    <table id="searchresults">
      <tr class="data-row">
        <td class="colTitle"><a href="/job/Service-Desk-Coordinator/1361461155/" class="jobTitle-link">Service Desk Coordinator</a></td>
        <td class="colLocation"><span class="jobLocation">Mohali</span></td>
        <td class="colDepartment"><span class="jobDepartment">India</span></td>
        <td class="colDate"><span class="jobDate">Jul 17, 2026</span></td>
      </tr>
      <tr class="data-row">
        <td class="colTitle"><a href="/job/Total-Rewards-Specialist/1360358155/" class="jobTitle-link">Total Rewards Specialist</a></td>
        <td class="colLocation"><span class="jobLocation">Sydney</span></td>
        <td class="colDepartment"><span class="jobDepartment">Australia</span></td>
        <td class="colDate"><span class="jobDate">Jul 14, 2026</span></td>
      </tr>
    </table>
  </body>
</html>
`

const avasoListingPage2Html = `
<!doctype html>
<html lang="en">
  <body>
    <h1 class="keyword-title">Search results for "".</h1>
    <span class="srHelp">Page 2 of 2</span>
    <table id="searchresults">
      <tr class="data-row">
        <td class="colTitle"><a href="/job/Associate-Manager-Service-Delivery/1354933555/" class="jobTitle-link">Associate Manager Service Delivery</a></td>
        <td class="colLocation"><span class="jobLocation">Bangalore</span></td>
        <td class="colDepartment"><span class="jobDepartment">India</span></td>
        <td class="colDate"><span class="jobDate">Jul 9, 2026</span></td>
      </tr>
    </table>
  </body>
</html>
`

const avasoServiceDeskDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Service Desk Coordinator Job Details | AVASO TECH PRIVATE LIMITED</title>
    <meta property="og:title" content="Service Desk Coordinator" />
  </head>
  <body>
    <div class="jobDisplayShell">
      <meta itemprop="datePosted" content="Fri Jul 17 00:00:00 UTC 2026" />
      <div class="jobTitle">
        <a class="apply dialogApplyBtn" href="/talentcommunity/apply/1361461155/?locale=en_US">Apply now »</a>
      </div>
      <div class="job">
        <p><strong>Location</strong></p>
        <ul><li>Mohali/Bengaluru, India</li></ul>
        <p><strong>Work Model</strong></p>
        <ul><li>Office-based</li></ul>
        <p><strong>Key Responsibilities</strong></p>
        <ul>
          <li>Coordinate 24x7 service desk operations for enterprise customers.</li>
          <li>Manage ticket queues and stakeholder escalations.</li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const avasoAssociateManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate Manager Service Delivery Job Details | AVASO TECH PRIVATE LIMITED</title>
  </head>
  <body>
    <div class="jobDisplayShell">
      <div class="jobTitle">
        <a class="apply dialogApplyBtn" href="/talentcommunity/apply/1354933555/?locale=en_US">Apply now »</a>
      </div>
      <div class="job">
        <p><strong>Location</strong></p>
        <ul><li>Bangalore, India</li></ul>
        <p><strong>Key Responsibilities</strong></p>
        <ul>
          <li>Own service-delivery governance across key customer accounts.</li>
          <li>Lead performance reviews and operational reporting.</li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const rmIndiaHtml = `
<!doctype html>
<html lang="en">
  <head><title>RM India</title></head>
  <body>
    <h1>RM India</h1>
    <p>Life @ RM India</p>
    <p>Come to Trivandrum</p>
    <p>When you join RM India, you do not just join another tech company.</p>
  </body>
</html>
`

const rmJobsShellHtml = `
<!doctype html>
<html lang="en">
  <head><title>RM Careers</title></head>
  <body>
    <p>About RM</p>
    <p>Search Jobs</p>
    <p>See jobs by:</p>
    <p>Categories</p>
    <p>Locations</p>
  </body>
</html>
`

const rmLocationsHtml = `
<!doctype html>
<html lang="en">
  <head><title>RM Education Limited Careers</title></head>
  <body>
    <h1>RM Education Limited Careers</h1>
    <p>By City | By State / Province | By Country</p>
    <a href="/jobs/locations/city/Trivandrum">Trivandrum</a>
    <a href="/jobs/locations/country/India">India</a>
  </body>
</html>
`

const rmIndiaCountryShellHtml = `
<!doctype html>
<html lang="en">
  <head><title>RM Education Limited</title></head>
  <body>
    <p>See jobs by:</p>
    <p>Categories</p>
    <p>Locations</p>
  </body>
</html>
`

const ymslCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Yamaha - Careers</title>
    <meta name="description" content="Current Openings - We welcome smart, dynamic, confident and aspiring individuals to join our team." />
  </head>
  <body>
    <h2>Be Cautious</h2>
    <p>Yamaha Motor Solutions (India) Pvt. Ltd. does not authorize any third party.</p>
    <a href="/ymsl/jobslist">View jobs</a>
    <h1>Find Authentic Jobs at Yamaha Motor Solutions</h1>
  </body>
</html>
`

const ymslSearchResults = [
  {
    _source: {
      id: 693428,
      jobTitle: 'React Solution Architect',
      jobUrl: 'react-solution-architect-faridabad-haryana-india-2025091918005845',
      location: 'Faridabad, Haryana, India',
      experienceUIField: '7-10 years',
      mandatorySkills: ['React.js', 'JavaScript (ES6+)', 'TypeScript'],
      modifiedDate: 1758292912614,
      refNumber: '10415',
      shortDescriptionDb: 'Lead architecture for enterprise-grade front-end platforms.',
    },
  },
  {
    _source: {
      id: 960872,
      jobTitle: 'SAP Cutover Manager',
      jobUrl: 'sap-cutover-manager-faridabad-haryana-india-2026062519451929',
      location: 'Faridabad, Haryana, India',
      experienceUIField: '10-15 years',
      mandatorySkills: ['Cutover Planning', 'SAP S/4HANA'],
      modifiedDate: 1784018541796,
      refNumber: '10606',
      shortDescriptionDb: 'Drive cutover planning and execution for SAP programs.',
    },
  },
  {
    _source: {
      id: 970001,
      jobTitle: 'Connected Vehicle Engineer',
      jobUrl: 'connected-vehicle-engineer-tokyo-japan-202607011030',
      location: 'Tokyo, Japan',
      experienceUIField: '5-7 years',
      mandatorySkills: ['IoT', 'Embedded Systems'],
      modifiedDate: 1783000000000,
      refNumber: '10620',
      shortDescriptionDb: 'Build connected-mobility telemetry systems.',
    },
  },
]

const smartDataCareersHtml = `
<!doctype html>
<html lang="en">
  <head><title>smartData Careers | Job Openings & Career Opportunities</title></head>
  <body>
    <h1>Careers</h1>
    <h2>Current Openings</h2>
    <div class="awsm-job-listing-item awsm-list-item">
      <div class="awsm-job-item">
        <div class="awsm-list-left-col">
          <h2 class="awsm-job-post-title"><a href="https://www.smartdatainc.com/jobs/associate-software-developer-net-ms/">Associate Software Developer – .NET (MS)</a></h2>
        </div>
        <div class="awsm-list-right-col">
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Full Time</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-label"><strong>Location: </strong></span><span class="awsm-job-specification-term">Mohali</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-experience"><span class="awsm-job-specification-term">3+ Years</span></div>
          </div>
          <div class="custom-job-description">
            <div class="full-desc">
              <p><strong>Must Have Skills</strong></p>
              <ul><li>ASP.NET / .NET Core</li><li>Angular</li><li>PostgreSQL</li></ul>
              <p><strong>Key Responsibilities</strong></p>
              <ul><li>Develop and maintain applications using ASP.NET/.NET Core.</li><li>Manage PostgreSQL databases and queries.</li></ul>
            </div>
          </div>
          <div class="awsm-job-more-container"><a class="awsm-job-more" href="https://www.smartdatainc.com/jobs/associate-software-developer-net-ms/">More Details</a></div>
        </div>
      </div>
    </div>
    <div class="awsm-job-listing-item awsm-list-item">
      <div class="awsm-job-item">
        <div class="awsm-list-left-col">
          <h2 class="awsm-job-post-title"><a href="https://www.smartdatainc.com/jobs/lead-java-developer/">Lead Java Developer</a></h2>
        </div>
        <div class="awsm-list-right-col">
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Consultant (1 year)</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Mohali</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-experience"><span class="awsm-job-specification-term">7+ Years</span></div>
          </div>
          <div class="custom-job-description">
            <div class="full-desc">
              <p>We are looking for a highly skilled and motivated Senior Java Developer with 5+ years of hands-on experience.</p>
              <p><strong>Required Skills</strong></p>
              <ul><li>Spring Boot</li><li>Oracle Database</li></ul>
            </div>
          </div>
          <div class="awsm-job-more-container"><a class="awsm-job-more" href="https://www.smartdatainc.com/jobs/lead-java-developer/">More Details</a></div>
        </div>
      </div>
    </div>
    <div class="awsm-job-listing-item awsm-list-item">
      <div class="awsm-job-item">
        <div class="awsm-list-left-col">
          <h2 class="awsm-job-post-title"><a href="https://www.smartdatainc.com/jobs/outbound-sales-development-intern-part-time/">Outbound Sales Development Intern (Part-Time)</a></h2>
        </div>
        <div class="awsm-list-right-col">
          <div class="awsm-job-specification-wrapper">
            <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Part Time</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Remote / Work-from-home</span></div>
            <div class="awsm-job-specification-item awsm-job-specification-job-experience"><span class="awsm-job-specification-term">0-1 Years</span></div>
          </div>
          <div class="custom-job-description">
            <div class="full-desc">
              <p>Work with the outbound growth team.</p>
            </div>
          </div>
          <div class="awsm-job-more-container"><a class="awsm-job-more" href="https://www.smartdatainc.com/jobs/outbound-sales-development-intern-part-time/">More Details</a></div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const civicaCareersHtml = `
<!doctype html>
<html lang="en">
  <head><title>Careers | Civica</title></head>
  <body>
    <h1>Make your future part of ours</h1>
    <p>Join the Civica team today.</p>
    <a href="https://apply.workable.com/civica/">Our vacancies</a>
  </body>
</html>
`

const civicaLlmsText = `
# Civica Careers

## Open Positions
- All open roles (GET \`https://apply.workable.com/civica/jobs.md\`): 0 current openings

## Optional
- [Careers page](https://apply.workable.com/civica/): Main careers page
`

test('AVASO Technology Solutions extracts India jobs from the verified SuccessFactors search pages and detail pages', async () => {
  const avaso = await loadModule('../../scraper/avasotechnologysolutions/script.js')

  assert.equal(avaso.hasOfficialCareersSignal(avasoListingPage1Html), true)
  assert.deepEqual(
    avaso.extractJobCards(avasoListingPage1Html).map((job) => ({
      title: job.title,
      city: job.city,
      country: job.country,
      detailUrl: job.detailUrl,
    })),
    [
      {
        title: 'Service Desk Coordinator',
        city: 'Mohali',
        country: 'India',
        detailUrl: 'https://careers.avasotech.com/job/Service-Desk-Coordinator/1361461155/',
      },
      {
        title: 'Total Rewards Specialist',
        city: 'Sydney',
        country: 'Australia',
        detailUrl: 'https://careers.avasotech.com/job/Total-Rewards-Specialist/1360358155/',
      },
    ],
  )

  const jobs = await avaso.createAvasoTechnologySolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === avaso.CAREERS_URL) return avasoListingPage1Html
      if (url.includes('startrow=25')) return avasoListingPage2Html
      if (url === 'https://careers.avasotech.com/job/Service-Desk-Coordinator/1361461155/') {
        return avasoServiceDeskDetailHtml
      }
      if (url === 'https://careers.avasotech.com/job/Associate-Manager-Service-Delivery/1354933555/') {
        return avasoAssociateManagerDetailHtml
      }
      throw new Error(`Unexpected AVASO URL: ${url}`)
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      city: job.city,
      country: job.country,
      postingDate: job.postingDate,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Associate Manager Service Delivery',
        city: 'Bangalore',
        country: 'India',
        postingDate: '2026-07-09',
        applyUrl: 'https://careers.avasotech.com/talentcommunity/apply/1354933555/?locale=en_US',
      },
      {
        title: 'Service Desk Coordinator',
        city: 'Mohali',
        country: 'India',
        postingDate: '2026-07-17',
        applyUrl: 'https://careers.avasotech.com/talentcommunity/apply/1361461155/?locale=en_US',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /service-delivery governance/i)
  assert.match(jobs[1].jobDescription, /ticket queues/i)
})

test('RM Education Solutions stays fail-closed while the verified RM India page leads to a non-enumerable Jibe shell', async () => {
  const rm = await loadModule('../../scraper/rmeducationsolutions/script.js')

  assert.equal(rm.hasOfficialIndiaSignal(rmIndiaHtml), true)
  assert.equal(rm.hasVerifiedJobsShell(rmJobsShellHtml), true)
  assert.equal(rm.hasVerifiedJobsShell(rmIndiaCountryShellHtml), true)

  const jobs = await rm.createRmEducationSolutionsScraper().run({
    fetchText: async (url) => {
      if (url === rm.INDIA_PAGE_URL) return rmIndiaHtml
      if (url === rm.CAREERS_URL) return rmJobsShellHtml
      if (url === rm.LOCATIONS_URL) return rmLocationsHtml
      if (url === rm.INDIA_COUNTRY_URL) return rmIndiaCountryShellHtml
      throw new Error(`Unexpected RM URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    rm.createRmEducationSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === rm.INDIA_PAGE_URL) return rmIndiaHtml
        if (url === rm.CAREERS_URL) return rmJobsShellHtml
        if (url === rm.LOCATIONS_URL) return rmLocationsHtml
        if (url === rm.INDIA_COUNTRY_URL) {
          return `
            <html><body>
              <a href="/jobs/3580?lang=en-us">DevOps Engineer in Trivandrum, India</a>
            </body></html>
          `
        }
        throw new Error(`Unexpected RM URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})

test('Yamaha Motors Solutions extracts India jobs from the verified public zwayam search feed', async () => {
  const ymsl = await loadModule('../../scraper/yamahamotorssolutions/script.js')

  assert.equal(ymsl.hasOfficialCareersSignal(ymslCareersHtml), true)
  assert.equal(ymsl.SEARCH_API_URL, 'https://public.zwayam.com/manageESQueries/searchJob')
  assert.equal(ymsl.COMPANY_ID, '15506')

  const jobs = await ymsl.createYamahaMotorsSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, ymsl.CAREERS_URL)
      return ymslCareersHtml
    },
    searchJobs: async () => ymslSearchResults,
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'React Solution Architect',
        location: 'Faridabad, Haryana, India',
        city: 'Faridabad',
        country: 'India',
        jobId: '693428',
        applyUrl: 'https://careers.ymsl.in/ymsl/jobview/react-solution-architect-faridabad-haryana-india-2025091918005845?id=693428',
      },
      {
        title: 'SAP Cutover Manager',
        location: 'Faridabad, Haryana, India',
        city: 'Faridabad',
        country: 'India',
        jobId: '960872',
        applyUrl: 'https://careers.ymsl.in/ymsl/jobview/sap-cutover-manager-faridabad-haryana-india-2026062519451929?id=960872',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /architecture/i)
  assert.match(jobs[1].jobDescription, /cutover/i)
})

test('smartData Enterprises extracts India openings from the verified first-party inline listings', async () => {
  const smartData = await loadModule('../../scraper/smartdataenterprises/script.js')

  assert.equal(smartData.hasOfficialCareersSignal(smartDataCareersHtml), true)
  assert.deepEqual(
    smartData.extractJobCards(smartDataCareersHtml).map((job) => ({
      title: job.title,
      location: job.location,
      detailUrl: job.detailUrl,
    })),
    [
      {
        title: 'Associate Software Developer – .NET (MS)',
        location: 'Mohali',
        detailUrl: 'https://www.smartdatainc.com/jobs/associate-software-developer-net-ms/',
      },
      {
        title: 'Lead Java Developer',
        location: 'Mohali',
        detailUrl: 'https://www.smartdatainc.com/jobs/lead-java-developer/',
      },
      {
        title: 'Outbound Sales Development Intern (Part-Time)',
        location: 'Remote / Work-from-home',
        detailUrl: 'https://www.smartdatainc.com/jobs/outbound-sales-development-intern-part-time/',
      },
    ],
  )

  const jobs = await smartData.createSmartDataEnterprisesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, smartData.CAREERS_URL)
      return smartDataCareersHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      employmentType: job.employmentType,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Associate Software Developer – .NET (MS)',
        location: 'Mohali, India',
        city: 'Mohali',
        country: 'India',
        employmentType: 'Full Time',
        applyUrl: 'https://www.smartdatainc.com/jobs/associate-software-developer-net-ms/',
      },
      {
        title: 'Lead Java Developer',
        location: 'Mohali, India',
        city: 'Mohali',
        country: 'India',
        employmentType: 'Consultant (1 year)',
        applyUrl: 'https://www.smartdatainc.com/jobs/lead-java-developer/',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /PostgreSQL/i)
  assert.match(jobs[1].jobDescription, /Spring Boot/i)
})

test('Civica India replaces its retired empty board with current full native India details', async () => {
  const civica = await loadModule('../../scraper/civicaindia/script.js')
  const { civicaNativeOptions } = await import('./fixtures/civicaNativeOptions.js')
  const jobs = await civica.createCivicaIndiaScraper().run(civicaNativeOptions())
  assert.equal(jobs.length, 15)
  assert.ok(jobs.every(job => job.company === 'Civica' && job.country === 'India'))
  await assert.rejects(civica.run({ fetchPage: async url => ({ status: 200, url, html: civicaCareersHtml }) }), /handoff/i)
})
