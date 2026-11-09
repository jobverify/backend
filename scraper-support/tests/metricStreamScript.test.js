import { classifyScraperError } from '../utils/failureClassification.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GRC | Governance, Risk and Compliance Software Solutions</title>
  </head>
  <body>
    <main>
      <a href="/about-us/careers.htm">Careers</a>
      <h1>Connected GRC for the enterprise</h1>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers & Job Opportunities - MetricStream</title>
  </head>
  <body>
    <main>
      <h1>Careers at MetricStream</h1>
      <a href="https://career5.successfactors.eu/career?company=metricstre">Search Open Positions</a>
    </main>
  </body>
</html>
`

const searchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <div id="careerJobSearchContainer">
      <h2>Search for Openings</h2>
      <div>3 Jobs matched your search</div>
      <div>Page 1 of 1</div>
      <div>Items per page 10</div>
      <table>
        <tbody>
          <tr class="jobResultItem">
            <td>
              <div role="heading" aria-level="3">
                <a
                  class="jobTitle"
                  href="/career?career_ns=job_listing&company=metricstre&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=3563&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123"
                >
                  Business Analyst
                </a>
              </div>
              <div class="noteSection" role="note">
                <div>
                  Requisition ID: <span class="jobContentEM">3563</span> -
                  <span class="jobContentEM">Posted on 07/16/2026</span> -
                  <span class="jobContentEM">Professional Services</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['United Kingdom'])">Country (1)</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['London'])">City (1)</span>
                </div>
              </div>
            </td>
          </tr>
          <tr class="jobResultItem">
            <td>
              <div role="heading" aria-level="3">
                <a
                  class="jobTitle"
                  href="/career?career_ns=job_listing&company=metricstre&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=3509&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123"
                >
                  Product Manager
                </a>
              </div>
              <div class="noteSection" role="note">
                <div>
                  Requisition ID: <span class="jobContentEM">3509</span> -
                  <span class="jobContentEM">Posted on 06/24/2026</span> -
                  <span class="jobContentEM">Product Management</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['India'])">Country (1)</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['Bangalore'])">City (1)</span>
                </div>
              </div>
            </td>
          </tr>
          <tr class="jobResultItem">
            <td>
              <div role="heading" aria-level="3">
                <a
                  class="jobTitle"
                  href="/career?career_ns=job_listing&company=metricstre&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=3544&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta&_s.crb=abc123"
                >
                  Senior Functional Trainer
                </a>
              </div>
              <div class="noteSection" role="note">
                <div>
                  Requisition ID: <span class="jobContentEM">3544</span> -
                  <span class="jobContentEM">Posted on 06/24/2026</span> -
                  <span class="jobContentEM">Sales</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['India'])">Country (1)</span> -
                  <span class="jobMFieldContent" onclick="showMFieldDialog(['Bengaluru'])">City (1)</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>
`

const dwrBootstrapHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities</title>
  </head>
  <body>
    <h1 id="candidateProfileTitle">Career Opportunities</h1>
    <input id="career_ns" value="job_listing_summary" />
    <input id="company" value="metricstre" />
    <input type="hidden" name="ajaxSecKey" value="csrf-token" />
    <div id="careerJobSearchContainer"></div>
    <script>
      window.addEventListener("load", getInitialJobSearchData);
      careerJobSearchController.getInitialJobSearchData("", "", "", "Asia/Calcutta");
      var ajaxSecKey="csrf-token";
    </script>
  </body>
</html>
`

const buildDwrSummaryResponse = ({
  currentPage = 1,
  pageSize = 10,
  totalCount,
  postings,
  wrapInPayload = true,
}) => {
  const normalizedPostings = postings.map((posting) => ({
    id: Number(posting.requisitionId),
    title: posting.title,
    postingDate: posting.postingDate,
    otherValues: [[
      { fieldId: 'filter2', shortVal: posting.department },
      { fieldId: 'mfield1', shortVal: `["Country","${posting.country}"]` },
      { fieldId: 'mfield2', shortVal: `["City","${posting.city}"]` },
    ]],
  }))

  const payload = {
    results: {
      postingCount: totalCount ?? normalizedPostings.length,
      options: {
        pagination: {
          currentPage,
          pageSize,
          totalCount: totalCount ?? normalizedPostings.length,
          startRow: ((currentPage - 1) * pageSize) + 1,
          endRow: Math.min(currentPage * pageSize, totalCount ?? normalizedPostings.length),
          increaseCandSummaryPagination: false,
        },
        sortByColumn: 'JOB_POSTING_DATE',
        sortOrder: 'DESC',
      },
      postings: normalizedPostings,
    },
  }

  const callbackValue = wrapInPayload ? { payload } : payload

  return `
throw 'allowScriptTagRemoting is false.';
dwr.engine._remoteHandleCallback('0', '0', ${JSON.stringify(callbackValue)});
`
}

const productManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities: Product Manager (3509)</title>
  </head>
  <body>
    <main>
      <h1>Career Opportunities: Product Manager (3509)</h1>
      <p>Requisition ID 3509 - Posted 06/24/2026 - Product Management - India - Bangalore</p>
      <button
        id="applyButton_top"
        onclick="checkDpcs2AndProceed({isUserLoggedIn: false , jobReqId: 3509, evtSrc:'Apply'}); return false;"
      >
        Apply
      </button>
      <h2>Job Description</h2>
      <p>Drive product strategy, roadmap alignment, and launch readiness across governance workflows.</p>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Own roadmap planning for core GRC product capabilities.</li>
        <li>Partner with engineering and design on release execution.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>5+ years of enterprise product management experience.</li>
      </ul>
    </main>
  </body>
</html>
`

const trainerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities: Senior Functional Trainer (3544)</title>
  </head>
  <body>
    <main>
      <h1>Career Opportunities: Senior Functional Trainer (3544)</h1>
      <p>Requisition ID 3544 - Posted 06/24/2026 - Sales - India - Bengaluru</p>
      <button
        id="applyButton_top"
        onclick="checkDpcs2AndProceed({isUserLoggedIn: false , jobReqId: 3544, evtSrc:'Apply'}); return false;"
      >
        Apply
      </button>
      <h2>Job Description</h2>
      <p>Deliver product enablement for customer-facing teams and strategic programs.</p>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Lead functional training for enterprise platform rollouts.</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Strong facilitation and SaaS domain expertise.</li>
      </ul>
    </main>
  </body>
</html>
`

const loadMetricStreamModule = async () => {
  try {
    return await import('../../scraper/metricstream/script.js')
  } catch {
    assert.fail('Expected MetricStream scraper module at ../../scraper/metricstream/script.js')
  }
}

test('MetricStream helpers stay pinned to the verified first-party careers handoff and SuccessFactors search shape', async () => {
  const metricStream = await loadMetricStreamModule()

  assert.equal(metricStream.SOURCE, 'metricstream')
  assert.equal(metricStream.COMPANY_NAME, 'MetricStream')
  assert.equal(metricStream.HOMEPAGE_URL, 'https://www.metricstream.com/')
  assert.equal(
    metricStream.CAREERS_PAGE_URL,
    'https://www.metricstream.com/about-us/careers.htm',
  )
  assert.equal(
    metricStream.SUCCESSFACTORS_BOARD_URL,
    'https://career5.successfactors.eu/career?company=metricstre',
  )
  assert.equal(
    metricStream.SUCCESSFACTORS_SEARCH_URL,
    'https://career5.successfactors.eu/career?company=metricstre&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    metricStream.buildDetailUrl('3509'),
    'https://career5.successfactors.eu/career?career_ns=job_listing&company=metricstre&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=3509&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  )
  assert.equal(metricStream.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(metricStream.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    metricStream.extractSuccessFactorsHandoffUrl(careersHtml),
    metricStream.SUCCESSFACTORS_BOARD_URL,
  )
  assert.equal(metricStream.hasSuccessFactorsSearchPageSignal(searchHtml), true)
  assert.deepEqual(metricStream.extractSearchSummary(searchHtml), {
    totalJobs: 3,
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
  })
  assert.deepEqual(metricStream.extractSearchResults(searchHtml), [
    {
      title: 'Business Analyst',
      department: 'Professional Services',
      location: 'London, United Kingdom',
      city: 'London',
      country: 'United Kingdom',
      jobId: '3563',
      requisitionId: '3563',
      sourceUrl: metricStream.buildDetailUrl('3563'),
      applyUrl: metricStream.buildDetailUrl('3563'),
      postingDate: '2026-07-16',
    },
    {
      title: 'Product Manager',
      department: 'Product Management',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '3509',
      requisitionId: '3509',
      sourceUrl: metricStream.buildDetailUrl('3509'),
      applyUrl: metricStream.buildDetailUrl('3509'),
      postingDate: '2026-06-24',
    },
    {
      title: 'Senior Functional Trainer',
      department: 'Sales',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '3544',
      requisitionId: '3544',
      sourceUrl: metricStream.buildDetailUrl('3544'),
      applyUrl: metricStream.buildDetailUrl('3544'),
      postingDate: '2026-06-24',
    },
  ])
})

test('MetricStream extracts the verified SuccessFactors DWR response used by the live board on Thursday, August 13, 2026', async () => {
  const metricStream = await loadMetricStreamModule()

  const jobs = [...metricStream.extractSearchResults(
    buildDwrSummaryResponse({
      postings: [
        {
          requisitionId: '3567',
          title: 'Financial Data Engineer',
          postingDate: '31/07/2026',
          department: 'Finance/Accounting',
          country: 'United States',
          city: 'Remote',
        },
        {
          requisitionId: '3565',
          title: 'Project Manager',
          postingDate: '24/07/2026',
          department: 'Professional Services',
          country: 'United States',
          city: 'Remote',
        },
        {
          requisitionId: '3563',
          title: 'Business Analyst',
          postingDate: '16/07/2026',
          department: 'Professional Services',
          country: 'United Kingdom',
          city: 'London',
        },
      ],
      wrapInPayload: false,
    }),
  )].map((job) => ({ ...job }))

  assert.deepEqual(jobs, [
    {
      title: 'Financial Data Engineer',
      department: 'Finance/Accounting',
      location: 'Remote, United States',
      city: 'Remote',
      country: 'United States',
      jobId: '3567',
      requisitionId: '3567',
      sourceUrl: metricStream.buildDetailUrl('3567'),
      applyUrl: metricStream.buildDetailUrl('3567'),
      postingDate: '2026-07-31',
    },
    {
      title: 'Project Manager',
      department: 'Professional Services',
      location: 'Remote, United States',
      city: 'Remote',
      country: 'United States',
      jobId: '3565',
      requisitionId: '3565',
      sourceUrl: metricStream.buildDetailUrl('3565'),
      applyUrl: metricStream.buildDetailUrl('3565'),
      postingDate: '2026-07-24',
    },
    {
      title: 'Business Analyst',
      department: 'Professional Services',
      location: 'London, United Kingdom',
      city: 'London',
      country: 'United Kingdom',
      jobId: '3563',
      requisitionId: '3563',
      sourceUrl: metricStream.buildDetailUrl('3563'),
      applyUrl: metricStream.buildDetailUrl('3563'),
      postingDate: '2026-07-16',
    },
  ])
})

test('MetricStream detail extraction preserves the canonical public detail URL and sectioned description', async () => {
  const metricStream = await loadMetricStreamModule()

  const detail = metricStream.extractJobDetail(productManagerDetailHtml, {
    title: 'Product Manager',
    department: 'Product Management',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3509',
    requisitionId: '3509',
    sourceUrl: metricStream.buildDetailUrl('3509'),
    applyUrl: metricStream.buildDetailUrl('3509'),
    postingDate: '2026-06-24',
  })

  assert.deepEqual(detail, {
    title: 'Product Manager',
    department: 'Product Management',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3509',
    requisitionId: '3509',
    employmentType: null,
    experienceRequired: null,
    jobDescription: 'Job Description: Drive product strategy, roadmap alignment, and launch readiness across governance workflows.\n\nKey Responsibilities: Own roadmap planning for core GRC product capabilities. Partner with engineering and design on release execution.\n\nRequirements: 5+ years of enterprise product management experience.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Own roadmap planning for core GRC product capabilities.',
      'Partner with engineering and design on release execution.',
      '5+ years of enterprise product management experience.',
    ],
    postingDate: '2026-06-24',
    applyUrl: metricStream.buildDetailUrl('3509'),
    sourceUrl: metricStream.buildDetailUrl('3509'),
  })
})

test('MetricStream API-only search fails closed when the board requires undocumented pagination', async () => {
  const metricStream = await loadMetricStreamModule()

  await assert.rejects(
    metricStream.getLiveSearchPages({
      fetchText: async () => searchHtml.replace('Page 1 of 1', 'Page 1 of 2'),
    }),
    /MetricStream API-only migration required.*pagination.*browser automation is disabled/i,
  )
})

test('MetricStream API-only search reads a single verified SuccessFactors page over HTTP', async () => {
  const metricStream = await loadMetricStreamModule()
  const requestedUrls = []

  const pages = await metricStream.getLiveSearchPages({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return searchHtml
    },
  })

  assert.deepEqual(requestedUrls, [metricStream.SUCCESSFACTORS_SEARCH_URL])
  assert.deepEqual(pages, [searchHtml])
})

test('MetricStream getLiveSearchPages follows the verified DWR bootstrap contract when the board no longer renders static rows', async () => {
  const metricStream = await loadMetricStreamModule()

  const pages = await metricStream.getLiveSearchPages({
    fetchText: async () => dwrBootstrapHtml,
    fetchSearchSession: async () => ({
      html: dwrBootstrapHtml,
      csrfToken: 'csrf-token',
      cookieHeader: 'JSESSIONID=abc123',
    }),
    fetchDwrText: async ({ endpoint }) => {
      assert.equal(endpoint, 'getInitialJobSearchData')

      return buildDwrSummaryResponse({
        postings: [
          {
            requisitionId: '3567',
            title: 'Financial Data Engineer',
            postingDate: '31/07/2026',
            department: 'Finance/Accounting',
            country: 'United States',
            city: 'Remote',
          },
        ],
      })
    },
  })

  assert.equal(pages.length, 1)
  assert.deepEqual([...metricStream.extractSearchResults(pages[0])].map((job) => ({ ...job })), [
    {
      title: 'Financial Data Engineer',
      department: 'Finance/Accounting',
      location: 'Remote, United States',
      city: 'Remote',
      country: 'United States',
      jobId: '3567',
      requisitionId: '3567',
      sourceUrl: metricStream.buildDetailUrl('3567'),
      applyUrl: metricStream.buildDetailUrl('3567'),
      postingDate: '2026-07-31',
    },
  ])
})

test('MetricStream run keeps the scraper on the verified first-party careers handoff, public board, and India detail pages only', async () => {
  const metricStream = await loadMetricStreamModule()
  const requestedUrls = []

  const jobs = await metricStream.createMetricStreamScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === metricStream.HOMEPAGE_URL) return homepageHtml
      if (url === metricStream.CAREERS_PAGE_URL) return careersHtml
      if (url === metricStream.buildDetailUrl('3509')) return productManagerDetailHtml
      if (url === metricStream.buildDetailUrl('3544')) return trainerDetailHtml

      throw new Error(`Unexpected MetricStream URL: ${url}`)
    },
    getSearchPages: async () => [searchHtml],
    now: () => '2026-07-16T00:00:00.000Z',
  }).run()

  assert.deepEqual(requestedUrls, [
    metricStream.HOMEPAGE_URL,
    metricStream.CAREERS_PAGE_URL,
    metricStream.buildDetailUrl('3509'),
    metricStream.buildDetailUrl('3544'),
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Product Manager',
      company: 'MetricStream',
      department: 'Product Management',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      link: metricStream.buildDetailUrl('3509'),
      applyUrl: metricStream.buildDetailUrl('3509'),
      sourceUrl: metricStream.buildDetailUrl('3509'),
      source: 'metricstream',
      jobId: '3509',
      requisitionId: '3509',
      employmentType: null,
      experienceRequired: null,
      jobDescription: 'Job Description: Drive product strategy, roadmap alignment, and launch readiness across governance workflows.\n\nKey Responsibilities: Own roadmap planning for core GRC product capabilities. Partner with engineering and design on release execution.\n\nRequirements: 5+ years of enterprise product management experience.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Own roadmap planning for core GRC product capabilities.',
        'Partner with engineering and design on release execution.',
        '5+ years of enterprise product management experience.',
      ],
      postingDate: '2026-06-24',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      title: 'Senior Functional Trainer',
      company: 'MetricStream',
      department: 'Sales',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      link: metricStream.buildDetailUrl('3544'),
      applyUrl: metricStream.buildDetailUrl('3544'),
      sourceUrl: metricStream.buildDetailUrl('3544'),
      source: 'metricstream',
      jobId: '3544',
      requisitionId: '3544',
      employmentType: null,
      experienceRequired: null,
      jobDescription: 'Job Description: Deliver product enablement for customer-facing teams and strategic programs.\n\nKey Responsibilities: Lead functional training for enterprise platform rollouts.\n\nRequirements: Strong facilitation and SaaS domain expertise.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Lead functional training for enterprise platform rollouts.',
        'Strong facilitation and SaaS domain expertise.',
      ],
      postingDate: '2026-06-24',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('MetricStream fails closed when the verified careers handoff or public search surface drifts', async () => {
  const metricStream = await loadMetricStreamModule()

  await assert.rejects(
    metricStream.createMetricStreamScraper({
      fetchText: async (url) => {
        if (url === metricStream.HOMEPAGE_URL) return homepageHtml
        if (url === metricStream.CAREERS_PAGE_URL) {
          return careersHtml.replace(
            'https://career5.successfactors.eu/career?company=metricstre',
            'https://boards.greenhouse.io/metricstream',
          )
        }

        throw new Error(`Unexpected MetricStream URL: ${url}`)
      },
      getSearchPages: async () => [searchHtml],
    }).run(),
    /verified official careers page/i,
  )

  await assert.rejects(
    metricStream.createMetricStreamScraper({
      fetchText: async (url) => {
        if (url === metricStream.HOMEPAGE_URL) return homepageHtml
        if (url === metricStream.CAREERS_PAGE_URL) return careersHtml

        throw new Error(`Unexpected MetricStream URL: ${url}`)
      },
      getSearchPages: async () => ['<html><body><h1>Career Opportunities</h1></body></html>'],
    }).run(),
    /verified public successfactors search surface/i,
  )
})


const directCareersHtml = '<html><head><title>Careers &amp; Job Opportunities - MetricStream</title></head><body><h1>Join Our Team Today!</h1><div class="job-list">'
  + '<div class="job-card"><h2 class="job-title">Sales Director</h2><div class="meta-row"><span class="meta-item">United States</span><span class="meta-item">Sales</span><span class="meta-item">08/21/2026</span></div><p class="job-desc">Global enterprise sales.</p><a class="apply-btn" href="https://www.metricstream.com/careers/sales-director.html">Apply Now</a></div>'
  + '<div class="job-card"><h2 class="job-title">Head of Services</h2><div class="meta-row"><span class="meta-item">Bangalore, India</span><span class="meta-item">Customer Services &amp; Success</span><span class="meta-item">08/21/2026</span></div><p class="job-desc">Lead global customer services.</p><a class="apply-btn" href="https://www.metricstream.com/careers/head-of-services.html">Apply Now</a></div></div></body></html>'
const directIndiaDetail = '<html><head><title>Head of Services - Careers at MetricStream</title></head><body><h1 class="ms-jd__title">Head of Services</h1><span class="ms-jd__chip">Bangalore, India</span><main class="ms-jd__content"><h2>Job Description</h2><p>Lead global customer services with AI-enabled operations.</p><h2>Required Skills</h2><ul><li>20+ years of services leadership.</li></ul><h2>Education</h2><p>Bachelor degree.</p></main></body></html>'

test('MetricStream follows current first-party role cards and validates India detail identity', async () => {
  const metricStream = await loadMetricStreamModule()
  const calls = []
  const jobs = await metricStream.run({fetchText: async url => {
    calls.push(url)
    if (url === metricStream.HOMEPAGE_URL) return homepageHtml
    if (url === metricStream.CAREERS_PAGE_URL) return directCareersHtml
    if (url === 'https://www.metricstream.com/careers/head-of-services.html') return directIndiaDetail
    throw new Error('Unexpected URL: ' + url)
  }, getSearchPages: async () => {throw new Error('Retired ATS must not be used')}})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Head of Services')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-08-21')
  assert.match(jobs[0].jobDescription, /AI-enabled operations/)
  assert.deepEqual(calls, [metricStream.HOMEPAGE_URL, metricStream.CAREERS_PAGE_URL, jobs[0].sourceUrl])
})

test('MetricStream refuses incomplete direct cards, foreign detail URLs, and conflicting detail locations', async () => {
  const metricStream = await loadMetricStreamModule()
  const runDirect = (careers = directCareersHtml, detail = directIndiaDetail) => metricStream.run({fetchText: async url => url === metricStream.HOMEPAGE_URL ? homepageHtml : url === metricStream.CAREERS_PAGE_URL ? careers : detail})
  await assert.rejects(runDirect(directCareersHtml.replace('https://www.metricstream.com/careers/head-of-services.html', 'https://unrelated.example/careers/head-of-services.html')), /trusted first-party role|verified.*careers/i)
  await assert.rejects(runDirect(directCareersHtml.replace('Bangalore, India', '')), /incomplete.*role card/i)
  await assert.rejects(runDirect(directCareersHtml, directIndiaDetail.replace('Bangalore, India', 'United States')), error => {
    assert.match(error.message, /incomplete country scope.*conflicting/i)
    assert.deepEqual(classifyScraperError(error), {softFailure:true, upstreamOutage:false, failureKind:'incomplete_location_scope'})
    assert.equal(error.abortRetries,true)
    return true
  })
  await assert.rejects(runDirect(directCareersHtml, directIndiaDetail.replace('>Head of Services</h1>', '>Other Role</h1>')), /detail identity/i)
})
