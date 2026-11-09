import assert from 'node:assert/strict'
import test from 'node:test'

const CAREER_PAGE_URL = 'https://www.stonex.com/en/about/careers/jobs/'
const SEARCH_WRAPPER_URL = 'https://english-stonex.icims.com/jobs/search?ss=1'
const SEARCH_RESULTS_URL = 'https://english-stonex.icims.com/jobs/search?ss=1&in_iframe=1'
const SEARCH_PAGE_2_URL = 'https://english-stonex.icims.com/jobs/search?pr=1&in_iframe=1&searchRelation=keyword_all'
const DETAIL_URL = 'https://english-stonex.icims.com/jobs/15550/head-of-financial-crime-prevention-model-analytics/job'
const DETAIL_FETCH_URL = `${DETAIL_URL}?in_iframe=1`
const APPLY_URL = 'https://english-stonex.icims.com/jobs/15550/head-of-financial-crime-prevention-model-analytics/job?apply=yes&hashed=-1834414340&mode=apply'

const searchPageOneHtml = `
  <html>
    <head>
      <title>Job Listings at StoneX</title>
      <link rel="next" href="https://english-stonex.icims.com/jobs/search?pr=1&amp;in_iframe=1&amp;searchRelation=keyword_all" />
    </head>
    <body>
      <ul class="container-fluid iCIMS_JobsTable">
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Job Locations</span>
              <span>IN-Bangalore | IN-Pune</span>
            </div>
            <div class="col-xs-6 header right">
              <span class="sr-only field-label">Requisition ID</span>
              <span>2026-15550</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://english-stonex.icims.com/jobs/15550/head-of-financial-crime-prevention-model-analytics/job?in_iframe=1" class="iCIMS_Anchor">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>Head of Financial Crime Prevention Model Analytics</h3>
              </a>
            </div>
            <div class="col-xs-12 description">
              Lead model analytics, calibration, and sanctions screening governance for APAC.
            </div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Compliance</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Position Type (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Experienced Professional</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Job Locations</span>
              <span>US-NY-New York</span>
            </div>
            <div class="col-xs-6 header right">
              <span class="sr-only field-label">Requisition ID</span>
              <span>2026-15479</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://english-stonex.icims.com/jobs/15479/aml-advisory-team-lead---broker-dealer-securities-division/job?in_iframe=1" class="iCIMS_Anchor">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>AML Advisory Team Lead - Broker-Dealer Securities Division</h3>
              </a>
            </div>
            <div class="col-xs-12 description">Ignore this non-India role.</div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Compliance</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Position Type (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Experienced Professional</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      </ul>
    </body>
  </html>
`

const searchPageTwoHtml = `
  <html>
    <head>
      <title>Job Listings at StoneX</title>
      <link rel="prev" href="https://english-stonex.icims.com/jobs/search?ss=1&amp;in_iframe=1" />
    </head>
    <body>
      <ul class="container-fluid iCIMS_JobsTable">
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Job Locations</span>
              <span>IN-Bangalore</span>
            </div>
            <div class="col-xs-6 header right">
              <span class="sr-only field-label">Requisition ID</span>
              <span>2026-15503</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://english-stonex.icims.com/jobs/15503/linux-engineer/job?in_iframe=1" class="iCIMS_Anchor">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>Linux Engineer</h3>
              </a>
            </div>
            <div class="col-xs-12 description">
              Build and automate Linux infrastructure for global trading systems.
            </div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Information Technology</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Position Type (Portal Searching)</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Experienced Professional</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      </ul>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <div class="iCIMS_JobContainer">
        <div class="iCIMS_JobContent">
          <div class="container-fluid iCIMS_JobsTable">
            <div class="row">
              <div class="col-xs-12 title">
                <div id="iCIMS_Header" tabindex="-1">
                  <h1 class="iCIMS_Header">Head of Financial Crime Prevention Model Analytics</h1>
                </div>
              </div>
              <div class="col-xs-6 header left">
                <span class="sr-only field-label">Job Locations</span>
                <span>IN-Bangalore | IN-Pune</span>
              </div>
              <div class="col-xs-6 header right">
                <span class="sr-only field-label">Requisition ID</span>
                <span>2026-15550</span>
              </div>
              <div class="col-xs-12 additionalFields">
                <dl class="iCIMS_JobHeaderGroup">
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Category (Portal Searching)</dt>
                    <dd class="iCIMS_JobHeaderData"><span>Compliance</span></dd>
                  </div>
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Position Type (Portal Searching)</dt>
                    <dd class="iCIMS_JobHeaderData"><span>Experienced Professional</span></dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Overview</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <p>Lead model analytics, calibration, and sanctions screening governance for APAC.</p>
              </div>
            </div>
          </div>
          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Responsibilities</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <ul>
                  <li>Monitor transaction-monitoring performance.</li>
                  <li>Define analytical testing and UAT readiness.</li>
                </ul>
              </div>
            </div>
          </div>
          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Qualifications</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <ul>
                  <li>Financial crime analytics expertise</li>
                  <li>Strong data-governance background</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="iCIMS_JobOptions">
            <a
              href="https://english-stonex.icims.com/jobs/15550/head-of-financial-crime-prevention-model-analytics/job?mode=apply&apply=yes&in_iframe=1&hashed=-1834414340"
              class="iCIMS_Anchor iCIMS_Action_Button iCIMS_ApplyOnlineButton iCIMS_PrimaryButton"
              title="Apply for this job online"
            >
              Apply for this job online
            </a>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const linuxEngineerDetailHtml = `
  <html>
    <body>
      <div class="iCIMS_JobContainer">
        <div class="iCIMS_JobContent">
          <div class="container-fluid iCIMS_JobsTable">
            <div class="row">
              <div class="col-xs-12 title">
                <div id="iCIMS_Header" tabindex="-1">
                  <h1 class="iCIMS_Header">Linux Engineer</h1>
                </div>
              </div>
              <div class="col-xs-6 header left">
                <span class="sr-only field-label">Job Locations</span>
                <span>IN-Bangalore</span>
              </div>
              <div class="col-xs-6 header right">
                <span class="sr-only field-label">Requisition ID</span>
                <span>2026-15503</span>
              </div>
              <div class="col-xs-12 additionalFields">
                <dl class="iCIMS_JobHeaderGroup">
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Category (Portal Searching)</dt>
                    <dd class="iCIMS_JobHeaderData"><span>Information Technology</span></dd>
                  </div>
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Position Type (Portal Searching)</dt>
                    <dd class="iCIMS_JobHeaderData"><span>Experienced Professional</span></dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Overview</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <p>Build and automate Linux infrastructure for global trading systems.</p>
              </div>
            </div>
          </div>
          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Qualifications</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <ul>
                  <li>Linux administration</li>
                  <li>Automation and observability</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const loadStoneXIndiaModule = async () => {
  try {
    return await import('../../scraper/stonexindia/script.js')
  } catch {
    assert.fail('Expected StoneX India scraper module at ../../scraper/stonexindia/script.js')
  }
}

test('StoneX India URL helpers stay pinned to the live official careers and iCIMS search surfaces', async () => {
  const stoneXIndia = await loadStoneXIndiaModule()

  assert.equal(stoneXIndia.CAREER_PAGE_URL, CAREER_PAGE_URL)
  assert.equal(stoneXIndia.ICIMS_HOST, 'https://english-stonex.icims.com')
  assert.equal(stoneXIndia.SEARCH_WRAPPER_URL, SEARCH_WRAPPER_URL)
  assert.equal(stoneXIndia.SEARCH_RESULTS_URL, SEARCH_RESULTS_URL)
  assert.equal(stoneXIndia.ICIMS_USER_AGENT, 'Mozilla/5.0')
  assert.doesNotMatch(stoneXIndia.ICIMS_USER_AGENT, /Chrome|Safari|Windows NT/i)
  assert.equal(stoneXIndia.buildCareerPageUrl(), CAREER_PAGE_URL)
  assert.equal(stoneXIndia.buildSearchWrapperUrl(), SEARCH_WRAPPER_URL)
  assert.equal(stoneXIndia.buildSearchResultsUrl(), SEARCH_RESULTS_URL)
  assert.equal(stoneXIndia.buildSearchPageUrl(), SEARCH_RESULTS_URL)
  assert.equal(stoneXIndia.buildSearchPageUrl(1), SEARCH_PAGE_2_URL)
  assert.equal(
    stoneXIndia.buildDetailUrl({ jobId: '15550', slug: 'head-of-financial-crime-prevention-model-analytics' }),
    DETAIL_URL,
  )
  assert.equal(
    stoneXIndia.buildDetailFetchUrl({ jobId: '15550', slug: 'head-of-financial-crime-prevention-model-analytics' }),
    DETAIL_FETCH_URL,
  )
  assert.equal(stoneXIndia.hasOfficialJobsPageSignal(searchPageOneHtml), true)
  assert.equal(stoneXIndia.hasOfficialJobsPageSignal('<html><title>Other Company Jobs</title></html>'), false)
  assert.equal(stoneXIndia.extractNextPageUrl(searchPageOneHtml), SEARCH_PAGE_2_URL)
  assert.equal(stoneXIndia.extractNextPageUrl(searchPageTwoHtml), null)
})

test('StoneX India default fetch is bounded by a timeout signal', async () => {
  const stoneXIndia = await loadStoneXIndiaModule()
  let capturedInit = null

  const html = await stoneXIndia.defaultFetchText(stoneXIndia.SEARCH_RESULTS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        ok: true,
        status: 200,
        text: async () => searchPageOneHtml,
      }
    },
  })

  assert.equal(html, searchPageOneHtml)
  assert.equal(capturedInit.headers.Accept, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('extractJobCards keeps only India jobs from the live StoneX iCIMS search surface', async () => {
  const stoneXIndia = await loadStoneXIndiaModule()
  const jobs = stoneXIndia.extractJobCards(searchPageOneHtml)

  assert.deepEqual(jobs, [{
    title: 'Head of Financial Crime Prevention Model Analytics',
    company: 'StoneX India',
    department: 'Compliance',
    location: 'Bangalore, Pune, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15550',
    requisitionId: '2026-15550',
    sourceUrl: DETAIL_URL,
    applyUrl: DETAIL_URL,
    employmentType: 'Experienced Professional',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead model analytics, calibration, and sanctions screening governance for APAC.',
  }])
})

test('extractJobDetail reads StoneX iCIMS metadata, job description, and canonical apply URL from the detail page', async () => {
  const stoneXIndia = await loadStoneXIndiaModule()
  const detail = stoneXIndia.extractJobDetail(detailHtml, {
    title: 'Head of Financial Crime Prevention Model Analytics',
    company: 'StoneX India',
    department: 'Compliance',
    location: 'Bangalore, Pune, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15550',
    requisitionId: '2026-15550',
    sourceUrl: DETAIL_URL,
    applyUrl: DETAIL_URL,
    employmentType: 'Experienced Professional',
    jobDescription: 'Lead model analytics, calibration, and sanctions screening governance for APAC.',
  })

  assert.deepEqual(detail, {
    title: 'Head of Financial Crime Prevention Model Analytics',
    company: 'StoneX India',
    department: 'Compliance',
    location: 'Bangalore, Pune, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15550',
    requisitionId: '2026-15550',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Experienced Professional',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Financial crime analytics expertise',
      'Strong data-governance background',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead model analytics, calibration, and sanctions screening governance for APAC. Monitor transaction-monitoring performance. Define analytical testing and UAT readiness. Financial crime analytics expertise Strong data-governance background',
    publicExperienceChecked: true,
  })
})

test('run paginates the live StoneX iCIMS search results, enriches India detail pages, and decorates shared runner fields', async () => {
  const stoneXIndia = await loadStoneXIndiaModule()
  const requestedUrls = []

  const jobs = await stoneXIndia.createStoneXIndiaScraper({
    now: () => '2026-08-05T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === SEARCH_RESULTS_URL) return searchPageOneHtml
      if (url === SEARCH_PAGE_2_URL) return searchPageTwoHtml
      if (url === DETAIL_FETCH_URL) return detailHtml
      if (url === 'https://english-stonex.icims.com/jobs/15503/linux-engineer/job?in_iframe=1') return linuxEngineerDetailHtml
      throw new Error(`Unexpected StoneX India fixture URL: ${url}`)
    },
    maxPages: 3,
  })

  assert.deepEqual(requestedUrls, [
    SEARCH_RESULTS_URL,
    DETAIL_FETCH_URL,
    SEARCH_PAGE_2_URL,
    'https://english-stonex.icims.com/jobs/15503/linux-engineer/job?in_iframe=1',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Head of Financial Crime Prevention Model Analytics',
    company: 'StoneX India',
    department: 'Compliance',
    location: 'Bangalore, Pune, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15550',
    requisitionId: '2026-15550',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Experienced Professional',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Financial crime analytics expertise',
      'Strong data-governance background',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead model analytics, calibration, and sanctions screening governance for APAC. Monitor transaction-monitoring performance. Define analytical testing and UAT readiness. Financial crime analytics expertise Strong data-governance background',
    publicExperienceChecked: true,
    link: APPLY_URL,
    source: 'stonexindia',
    scrapedAt: '2026-08-05T12:00:00.000Z',
  })
  assert.deepEqual(jobs[1], {
    title: 'Linux Engineer',
    company: 'StoneX India',
    department: 'Information Technology',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '15503',
    requisitionId: '2026-15503',
    sourceUrl: 'https://english-stonex.icims.com/jobs/15503/linux-engineer/job',
    applyUrl: 'https://english-stonex.icims.com/jobs/15503/linux-engineer/job',
    employmentType: 'Experienced Professional',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Linux administration',
      'Automation and observability',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build and automate Linux infrastructure for global trading systems. Linux administration Automation and observability',
    publicExperienceChecked: true,
    link: 'https://english-stonex.icims.com/jobs/15503/linux-engineer/job',
    source: 'stonexindia',
    scrapedAt: '2026-08-05T12:00:00.000Z',
  })
})
