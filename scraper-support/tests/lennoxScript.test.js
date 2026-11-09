import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_URL = 'https://www.lennox.com/careers/'
const SEARCH_PAGE_URL = 'https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1'
const DETAIL_URL = 'https://uscareers-lennox.icims.com/jobs/40057/senior-finance-analyst/job?in_iframe=1'
const APPLY_URL = 'https://uscareers-lennox.icims.com/jobs/40057/senior-finance-analyst/login?in_iframe=1'

const listingHtml = `
  <html>
    <head>
      <title>Search Results | Lennox Careers</title>
    </head>
    <body>
      <main>
        <div class="iCIMS_JobsTable">
          <div class="iCIMS_JobsTableRow">
            <a
              class="iCIMS_Anchor"
              href="https://uscareers-lennox.icims.com/jobs/40057/senior-finance-analyst/job?mobile=false&width=1640&height=500"
            >
              Senior Finance Analyst
            </a>
            <dl>
              <dt>Job ID</dt>
              <dd>40057</dd>
              <dt>Job Locations</dt>
              <dd>Richardson, TX, US</dd>
              <dt>Category</dt>
              <dd>Finance</dd>
              <dt>Posted Date</dt>
              <dd>07/01/2026</dd>
            </dl>
          </div>
        </div>
      </main>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <div class="iCIMS_JobContainer">
        <div id="iCIMS_Header" tabindex="-1">
          <h1 class="iCIMS_Header">Senior Finance Analyst</h1>
        </div>

        <dl class="iCIMS_JobHeaderGroup">
          <div class="iCIMS_JobHeaderTag">
            <dt class="iCIMS_JobHeaderField">Job Locations</dt>
            <dd class="iCIMS_JobHeaderData">Richardson, TX, US</dd>
          </div>
          <div class="iCIMS_JobHeaderTag">
            <dt class="iCIMS_JobHeaderField">Requisition ID</dt>
            <dd class="iCIMS_JobHeaderData">REQ-40057</dd>
          </div>
          <div class="iCIMS_JobHeaderTag">
            <dt class="iCIMS_JobHeaderField">Category</dt>
            <dd class="iCIMS_JobHeaderData">Finance</dd>
          </div>
          <div class="iCIMS_JobHeaderTag">
            <dt class="iCIMS_JobHeaderField">Position Type</dt>
            <dd class="iCIMS_JobHeaderData">Full-Time</dd>
          </div>
        </dl>

        <h2>Overview</h2>
        <div>
          <p>Support financial planning and business analysis for Lennox teams.</p>
        </div>

        <h2>Responsibilities</h2>
        <div>
          <ul>
            <li>Build monthly forecast reporting.</li>
            <li>Partner with operations leaders on variance analysis.</li>
          </ul>
        </div>

        <h2>Qualifications</h2>
        <div>
          <ul>
            <li>Advanced Excel</li>
            <li>Financial modeling</li>
          </ul>
        </div>

        <div class="iCIMS_JobOptions">
          <a
            class="iCIMS_ApplyOnlineButton"
            title="Apply for this job online"
            href="https://uscareers-lennox.icims.com/jobs/40057/senior-finance-analyst/job?mode=apply&apply=yes&in_iframe=1"
          >
            Apply for this job online
          </a>
        </div>
      </div>
    </body>
  </html>
`

const loadLennoxModule = async () => {
  try {
    return await import('../../scraper/lennox/script.js')
  } catch {
    assert.fail('Expected Lennox scraper module at ../../scraper/lennox/script.js')
  }
}

test('run fetches the verified Lennox iCIMS search surface and returns canonical detail and apply URLs', async () => {
  const lennox = await loadLennoxModule()
  const requestedUrls = []

  assert.equal(lennox.CAREERS_PAGE_URL, CAREERS_PAGE_URL)
  assert.equal(lennox.SEARCH_PAGE_URL, SEARCH_PAGE_URL)
  assert.equal(lennox.ICIMS_USER_AGENT, 'Mozilla/5.0')
  assert.doesNotMatch(lennox.ICIMS_USER_AGENT, /Chrome|Safari|Windows NT/i)
  assert.equal(lennox.buildSearchUrl(), SEARCH_PAGE_URL)
  assert.equal(lennox.hasOfficialJobsPageSignal(listingHtml), true)
  assert.equal(lennox.hasOfficialJobsPageSignal('<html><title>Other Company Jobs</title></html>'), false)

  const jobs = await lennox.createLennoxScraper({
    now: () => '2026-07-10T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === SEARCH_PAGE_URL) return listingHtml
      if (url === DETAIL_URL) return detailHtml
      throw new Error(`Unexpected Lennox fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    SEARCH_PAGE_URL,
    DETAIL_URL,
  ])

  assert.deepEqual(jobs, [{
    title: 'Senior Finance Analyst',
    company: 'Lennox',
    department: 'Finance',
    location: 'Richardson, TX, United States',
    city: 'Richardson',
    country: 'United States',
    jobId: '40057',
    requisitionId: 'REQ-40057',
    sourceUrl: DETAIL_URL,
    applyUrl: APPLY_URL,
    employmentType: 'Full-Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Advanced Excel',
      'Financial modeling',
    ],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Support financial planning and business analysis for Lennox teams. Build monthly forecast reporting. Partner with operations leaders on variance analysis. Advanced Excel Financial modeling',
    link: APPLY_URL,
    source: 'lennox',
    scrapedAt: '2026-07-10T12:00:00.000Z',
  }])
})
