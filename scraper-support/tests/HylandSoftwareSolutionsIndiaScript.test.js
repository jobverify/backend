import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Explore Opportunities Across the Globe | Hyland</title>
  </head>
  <body>
    <h1>Explore opportunities across the globe</h1>
    <p>Join our team</p>
    <p>Fraud alert</p>
    <a href="https://careers-hyland.icims.com/jobs/search?ss=1&amp;hashed=-435679902">Search</a>
    <a href="https://careers-hyland.icims.com/jobs/intro?hashed=-435679902&amp;mobile=false">Intro</a>
  </body>
</html>
`

const listingsPageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Hyland | Jobs in Software at Hyland | Job Listings at Hyland</title>
    <link rel="next" href="https://careers-hyland.icims.com/jobs/search?pr=2&amp;in_iframe=1" />
  </head>
  <body>
    <p>Please enable cookies in your browser</p>
    <p>Here are our current job openings.</p>
    <p>Use this form to perform another job search</p>
    <ul class="container-fluid iCIMS_JobsTable">
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-12 title">
            <a href="https://careers-hyland.icims.com/jobs/14222/senior-cyber-security-analyst---soc/job?in_iframe=1">
              <h3>Senior Cyber Security Analyst - SOC</h3>
            </a>
          </div>
          <div class="col-xs-12 description">Location: Colombia Work Arrangement: Remote Colombia</div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-14222</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Category</dt>
                <dd class="iCIMS_JobHeaderData"><span>Legal &amp; Information Security</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>Remote - Colombia</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-12 title">
            <a href="https://careers-hyland.icims.com/jobs/14209/internal-project-manager---customer-success-operations/job?in_iframe=1">
              <h3>Internal Project Manager - Customer Success Operations</h3>
            </a>
          </div>
          <div class="col-xs-12 description">Project Manager work model: Remote - India.</div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-14209</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Category</dt>
                <dd class="iCIMS_JobHeaderData"><span>Customer Success &amp; Operations</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>Remote - India</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </body>
</html>
`

const listingsPageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Hyland | Jobs in Software at Hyland | Job Listings at Hyland</title>
  </head>
  <body>
    <p>Please enable cookies in your browser</p>
    <p>Here are our current job openings.</p>
    <p>Use this form to perform another job search</p>
    <ul class="container-fluid iCIMS_JobsTable">
      <li class="iCIMS_JobCardItem">
        <div class="row">
          <div class="col-xs-12 title">
            <a href="https://careers-hyland.icims.com/jobs/14042/software-developer/job?in_iframe=1">
              <h3>Software Developer</h3>
            </a>
          </div>
          <div class="col-xs-12 description">Developer role in Hyderabad India Office.</div>
          <div class="col-xs-12 additionalFields">
            <dl class="iCIMS_JobHeaderGroup">
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Job ID</dt>
                <dd class="iCIMS_JobHeaderData"><span>2026-14042</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField">Category</dt>
                <dd class="iCIMS_JobHeaderData"><span>Technology - Engineering &amp; Testing</span></dd>
              </div>
              <div class="iCIMS_JobHeaderTag">
                <dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt>
                <dd class="iCIMS_JobHeaderData"><span>Hyderabad India Office</span></dd>
              </div>
            </dl>
          </div>
        </div>
      </li>
    </ul>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/hylandsoftwaresolutionsindia/script.js')
  } catch {
    assert.fail('Expected Hyland scraper module at ../../scraper/hylandsoftwaresolutionsindia/script.js')
  }
}

test('Hyland recognizes the current first-party careers handoff and iframe listing pages', async () => {
  const hyland = await loadModule()

  assert.equal(hyland.SOURCE, 'hylandsoftwaresolutionsindia')
  assert.equal(
    hyland.JOBS_SEARCH_URL,
    'https://careers-hyland.icims.com/jobs/search?pr=1&in_iframe=1',
  )
  assert.equal(hyland.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hyland.hasListingsSignal(listingsPageOneHtml), true)
  assert.equal(
    hyland.extractNextPageUrl(listingsPageOneHtml),
    'https://careers-hyland.icims.com/jobs/search?pr=2&in_iframe=1',
  )

  const jobs = hyland.extractJobs(listingsPageOneHtml)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Internal Project Manager - Customer Success Operations',
    company: 'Hyland Software Solutions India LLP',
    department: 'Customer Success & Operations',
    location: 'Remote - India',
    city: null,
    country: 'India',
    jobId: '2026-14209',
    requisitionId: '2026-14209',
    sourceUrl: 'https://careers-hyland.icims.com/jobs/14209/internal-project-manager---customer-success-operations/job?in_iframe=1',
    applyUrl: 'https://careers-hyland.icims.com/jobs/14209/internal-project-manager---customer-success-operations/job?in_iframe=1',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Project Manager work model: Remote - India.',
    publicExperienceChecked: true,
  })
})

test('Hyland run follows iframe pagination and keeps only India roles', async () => {
  const hyland = await loadModule()
  const requestedUrls = []

  const jobs = await hyland.createHylandSoftwareSolutionsIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hyland.CAREERS_URL) return careersHtml
      if (url === hyland.JOBS_SEARCH_URL) return listingsPageOneHtml
      if (url === 'https://careers-hyland.icims.com/jobs/search?pr=2&in_iframe=1') return listingsPageTwoHtml
      throw new Error(`Unexpected Hyland URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hyland.CAREERS_URL,
    hyland.JOBS_SEARCH_URL,
    'https://careers-hyland.icims.com/jobs/search?pr=2&in_iframe=1',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => [job.title, job.location, job.scrapedAt]), [
    ['Internal Project Manager - Customer Success Operations', 'Remote - India', FIXED_SCRAPED_AT],
    ['Software Developer', 'Hyderabad India', FIXED_SCRAPED_AT],
  ])
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})
