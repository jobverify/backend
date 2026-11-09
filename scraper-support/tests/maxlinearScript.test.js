import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_URL = 'https://www.maxlinear.com/company/careers'
const SEARCH_PAGE_URL = 'https://careersintl-maxlinear.icims.com/jobs/search?ss=1&in_iframe=1'
const SEARCH_PAGE_URL_PAGE_2 = 'https://careersintl-maxlinear.icims.com/jobs/search?pr=1&in_iframe=1'
const DETAIL_URL = 'https://careersintl-maxlinear.icims.com/jobs/3000/principal-asic-design-verification-engineer/job'
const DETAIL_FETCH_URL = `${DETAIL_URL}?in_iframe=1`
const APPLY_URL = 'https://careersintl-maxlinear.icims.com/jobs/3000/principal-asic-design-verification-engineer/job?apply=yes&hashed=-1834446046&mode=apply'

const careersPageHtml = `
  <html>
    <head><title>Careers - MaxLinear</title></head>
    <body>
      <h1>Find Your Future with MaxLinear</h1>
      <a href="https://careersus-maxlinear.icims.com">Browse all US Jobs</a>
      <a href="https://careersintl-maxlinear.icims.com/jobs/search?ss=1">Browse all International Jobs</a>
      <div class="featured-job">
        <h2>Principal Systems Engineer (Power)</h2>
        <span>IND-KA-Bangalore</span>
      </div>
    </body>
  </html>
`

const listingPageOneHtml = `
  <html>
    <head>
      <title>Job Listings at MaxLinear</title>
      <link rel="canonical" href="https://careersintl-maxlinear.icims.com/jobs/search?ss=1" />
      <link rel="next" href="https://careersintl-maxlinear.icims.com/jobs/search?pr=1&amp;in_iframe=1" />
    </head>
    <body>
      <div id="iCIMS_Header"><h1 class="iCIMS_Header">Job Listings</h1></div>
      <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Jobs">
        Here are our current job openings.
      </div>
      <ul class="iCIMS_JobsTable">
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Location : Location</span>
              <span>IND-KA-Bangalore</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://careersintl-maxlinear.icims.com/jobs/3000/principal-asic-design-verification-engineer/job?in_iframe=1" class="iCIMS_Anchor" title="3000 - Principal ASIC Design Verification Engineer">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>Principal ASIC Design Verification Engineer</h3>
              </a>
            </div>
            <div class="col-xs-12 description">
              We are seeking a Principal ASIC Design Verification Engineer to provide technical leadership.
            </div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category</dt>
                  <dd class="iCIMS_JobHeaderData"><span>ASIC Engineering</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">ID</dt>
                  <dd class="iCIMS_JobHeaderData"><span>2026-3000</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Location : Location</span>
              <span>ISR-Petah Tikva</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://careersintl-maxlinear.icims.com/jobs/3999/non-india-role/job?in_iframe=1" class="iCIMS_Anchor" title="3999 - Non India Role">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>Non India Role</h3>
              </a>
            </div>
            <div class="col-xs-12 description">Ignore this non-India listing.</div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category</dt>
                  <dd class="iCIMS_JobHeaderData"><span>ASIC Engineering</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">ID</dt>
                  <dd class="iCIMS_JobHeaderData"><span>2026-3999</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      </ul>
    </body>
  </html>
`

const listingPageTwoHtml = `
  <html>
    <head><title>Job Listings at MaxLinear</title></head>
    <body>
      <div id="iCIMS_Header"><h1 class="iCIMS_Header">Job Listings</h1></div>
      <ul class="iCIMS_JobsTable">
        <li class="iCIMS_JobCardItem">
          <div class="row">
            <div class="col-xs-6 header left">
              <span class="sr-only field-label">Location : Location</span>
              <span>IND-KA-Bangalore</span>
            </div>
            <div class="col-xs-12 title">
              <a href="https://careersintl-maxlinear.icims.com/jobs/2971/staff-firmware-engineer/job?in_iframe=1" class="iCIMS_Anchor" title="2971 - Staff Firmware Engineer">
                <span class="sr-only field-label">Job Posting Title</span>
                <h3>Staff Firmware Engineer</h3>
              </a>
            </div>
            <div class="col-xs-12 description">
              MaxLinear is seeking a Senior Firmware Engineer to join our Voice Software team at Bangalore.
            </div>
            <div class="col-xs-12 additionalFields">
              <dl class="iCIMS_JobHeaderGroup">
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">Category</dt>
                  <dd class="iCIMS_JobHeaderData"><span>Software Engineering</span></dd>
                </div>
                <div class="iCIMS_JobHeaderTag">
                  <dt class="iCIMS_JobHeaderField">ID</dt>
                  <dd class="iCIMS_JobHeaderData"><span>2026-2971</span></dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      </ul>
    </body>
  </html>
`

const terminalListingPageHtml = `
  <html>
    <head><title>Job Listings at MaxLinear</title></head>
    <body>
      <div class="iCIMS_Paging text-center">
        <a class="iCIMS_Anchor_Nav" href="https://careersintl-maxlinear.icims.com/jobs/intro?in_iframe=1">
          <span class="halflings halflings-menu-left" aria-hidden="true"></span>
          <span class="iCIMS_NavigationText">Welcome page</span>
        </a>
        <div class="iCIMS_PagingBatch">
          <a href="https://careersintl-maxlinear.icims.com/jobs/search?pr=2&amp;in_iframe=1" class="selected">
            <span class="sr-only">Page</span>
            3
            <span class="sr-only"> of 3 , Current Page </span>
          </a>
        </div>
        <a class="glyph invisible" href="https://careersintl-maxlinear.icims.com/jobs/search?pr=&amp;in_iframe=1" target="_self">
          <span class="sr-only">Next page of results</span>
          <span class="halflings halflings-menu-right" title="Next page of results" aria-hidden="true"></span>
        </a>
      </div>
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
                  <h1 class="iCIMS_Header">Principal ASIC Design Verification Engineer</h1>
                </div>
              </div>
              <div class="col-xs-12 additionalFields">
                <dl class="iCIMS_JobHeaderGroup">
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">ID</dt>
                    <dd class="iCIMS_JobHeaderData"><span>2026-3000</span></dd>
                  </div>
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField"><span class="glyphicons glyphicons-map-marker"></span><span class="sr-only field-label">Job Locations</span></dt>
                    <dd class="iCIMS_JobHeaderData"><span>IND-KA-Bangalore</span></dd>
                  </div>
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Category</dt>
                    <dd class="iCIMS_JobHeaderData"><span>ASIC Engineering</span></dd>
                  </div>
                  <div class="iCIMS_JobHeaderTag">
                    <dt class="iCIMS_JobHeaderField">Type</dt>
                    <dd class="iCIMS_JobHeaderData"><span>Full Time</span></dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Responsibilities</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <p>We are seeking a Principal ASIC Design Verification Engineer to provide technical leadership.</p>
                <ul>
                  <li>Act as a verification technical leader and architect across IP, Subsystem, and SoC programs</li>
                  <li>Define and own end-to-end verification strategies and best practices across teams</li>
                </ul>
              </div>
            </div>
          </div>

          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Qualifications</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <ul>
                  <li>Bachelor's or Master's degree in Electronic Engineering or a related field</li>
                  <li>12-16 years of deep, hands-on ASIC Design Verification experience</li>
                </ul>
              </div>
            </div>
          </div>

          <h2 class="iCIMS_InfoMsg iCIMS_InfoField_Job">Company Overview</h2>
          <div class="iCIMS_InfoMsg iCIMS_InfoMsg_Job">
            <div class="iCIMS_Expandable_Container">
              <div class="iCIMS_Expandable_Text">
                <p>MaxLinear is a global, NASDAQ-traded company.</p>
              </div>
            </div>
          </div>

          <div class="iCIMS_JobOptions">
            <a
              href="https://careersintl-maxlinear.icims.com/jobs/3000/principal-asic-design-verification-engineer/job?mode=apply&apply=yes&in_iframe=1&hashed=-1834446046"
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

const loadMaxLinearModule = async () => {
  try {
    return await import('../../scraper/maxlinear/script.js')
  } catch {
    assert.fail('Expected MaxLinear scraper module at ../../scraper/maxlinear/script.js')
  }
}

test('MaxLinear scraper stays pinned to the verified official careers and iCIMS India search surfaces', async () => {
  const maxlinear = await loadMaxLinearModule()

  assert.equal(maxlinear.CAREERS_PAGE_URL, CAREERS_PAGE_URL)
  assert.equal(maxlinear.ICIMS_USER_AGENT, 'Mozilla/5.0')
  assert.doesNotMatch(maxlinear.ICIMS_USER_AGENT, /Chrome|Safari|Windows NT/i)
  assert.equal(
    maxlinear.INTERNATIONAL_JOBS_URL,
    'https://careersintl-maxlinear.icims.com/jobs/search?ss=1',
  )
  assert.equal(maxlinear.buildSearchUrl(), SEARCH_PAGE_URL)
  assert.equal(maxlinear.buildSearchUrl(1), SEARCH_PAGE_URL_PAGE_2)
  assert.equal(maxlinear.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(maxlinear.hasOfficialCareersPageSignal('<html><title>Other Company</title></html>'), false)
  assert.equal(maxlinear.hasOfficialJobsPageSignal(listingPageOneHtml), true)
  assert.equal(maxlinear.hasOfficialJobsPageSignal('<html><h1>No Results</h1></html>'), false)
})

test('extractJobCards keeps only India jobs from the verified MaxLinear iCIMS listings page', async () => {
  const maxlinear = await loadMaxLinearModule()
  const jobs = maxlinear.extractJobCards(listingPageOneHtml)

  assert.deepEqual(jobs, [{
    title: 'Principal ASIC Design Verification Engineer',
    company: 'MaxLinear',
    department: 'ASIC Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3000',
    requisitionId: '2026-3000',
    sourceUrl: DETAIL_URL,
    applyUrl: DETAIL_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'We are seeking a Principal ASIC Design Verification Engineer to provide technical leadership.',
  }])
})

test('extractJobDetail reads MaxLinear iCIMS metadata, description sections, and canonical apply URL', async () => {
  const maxlinear = await loadMaxLinearModule()
  const detail = maxlinear.extractJobDetail(detailHtml, {
    title: 'Principal ASIC Design Verification Engineer',
    company: 'MaxLinear',
    department: 'ASIC Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3000',
    requisitionId: '2026-3000',
    sourceUrl: DETAIL_URL,
    applyUrl: DETAIL_URL,
    employmentType: null,
    jobDescription: 'We are seeking a Principal ASIC Design Verification Engineer to provide technical leadership.',
  })

  assert.deepEqual(detail, {
    title: 'Principal ASIC Design Verification Engineer',
    company: 'MaxLinear',
    department: 'ASIC Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3000',
    requisitionId: '2026-3000',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      "Bachelor's or Master's degree in Electronic Engineering or a related field",
      '12-16 years of deep, hands-on ASIC Design Verification experience',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: "We are seeking a Principal ASIC Design Verification Engineer to provide technical leadership. Act as a verification technical leader and architect across IP, Subsystem, and SoC programs Define and own end-to-end verification strategies and best practices across teams Bachelor's or Master's degree in Electronic Engineering or a related field 12-16 years of deep, hands-on ASIC Design Verification experience MaxLinear is a global, NASDAQ-traded company.",
  })
})

test('extractNextPageUrl ignores terminal-page controls that do not point to another listings page', async () => {
  const maxlinear = await loadMaxLinearModule()

  assert.equal(maxlinear.extractNextPageUrl(terminalListingPageHtml), null)
})

test('run validates the official MaxLinear careers handoff, paginates the public Bangalore board, and decorates jobs', async () => {
  const maxlinear = await loadMaxLinearModule()
  const requestedUrls = []

  const jobs = await maxlinear.createMaxLinearScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_PAGE_URL) return careersPageHtml
      if (url === SEARCH_PAGE_URL) return listingPageOneHtml
      if (url === SEARCH_PAGE_URL_PAGE_2) return listingPageTwoHtml
      if (url === DETAIL_FETCH_URL) return detailHtml
      if (url === 'https://careersintl-maxlinear.icims.com/jobs/2971/staff-firmware-engineer/job?in_iframe=1') {
        return detailHtml
          .replaceAll('Principal ASIC Design Verification Engineer', 'Staff Firmware Engineer')
          .replaceAll('2026-3000', '2026-2971')
          .replaceAll('/jobs/3000/principal-asic-design-verification-engineer/', '/jobs/2971/staff-firmware-engineer/')
          .replace('ASIC Engineering', 'Software Engineering')
      }
      throw new Error(`Unexpected MaxLinear fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_PAGE_URL,
    SEARCH_PAGE_URL,
    DETAIL_FETCH_URL,
    SEARCH_PAGE_URL_PAGE_2,
    'https://careersintl-maxlinear.icims.com/jobs/2971/staff-firmware-engineer/job?in_iframe=1',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Principal ASIC Design Verification Engineer',
        company: 'MaxLinear',
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '3000',
        sourceUrl: DETAIL_URL,
        applyUrl: APPLY_URL,
      },
      {
        title: 'Staff Firmware Engineer',
        company: 'MaxLinear',
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '2971',
        sourceUrl: 'https://careersintl-maxlinear.icims.com/jobs/2971/staff-firmware-engineer/job',
        applyUrl: 'https://careersintl-maxlinear.icims.com/jobs/2971/staff-firmware-engineer/job?apply=yes&hashed=-1834446046&mode=apply',
      },
    ],
  )
})
