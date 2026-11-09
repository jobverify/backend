import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMappedInventoryEvidence } from './helpers/assertMappedInventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T13:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at insightsoftware | Job Openings & Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Current Job Openings</h1>
      <p>Learn more about our high-energy, high-performance global team.</p>
      <ul class="locations">
        <li>India - Bangalore</li>
        <li>India - Hyderabad</li>
        <li>India - Hyderabad - Remote</li>
      </ul>
      <article class="job-card">
        <a href="https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad/Customer-Success-Analyst_R-2131">Customer Success Analyst</a>
        <span class="job-location">India - Hyderabad</span>
      </article>
      <article class="job-card">
        <a href="https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad---Remote/Director---Engineering_R-1904">Director - Engineering</a>
        <span class="job-location">India - Hyderabad - Remote</span>
      </article>
      <article class="job-card">
        <a href="https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Bangalore/Senior-Manager--Engineering_R-2106">Senior Manager, Engineering</a>
        <span class="job-location">India - Bangalore</span>
      </article>
      <article class="job-card">
        <a href="https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/USA---Remote/Enterprise-Account-Executive_R-9999">Enterprise Account Executive</a>
        <span class="job-location">USA - Remote</span>
      </article>
    </main>
  </body>
</html>
`

const currentEmptyCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at insightsoftware | Job Openings & Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Current Job Openings</h1>
      <p>Learn more about our high-energy, high-performance global team.</p>
      <div>Showing 0 of 0</div>
      <p>No job openings available at the moment.</p>
    </main>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://magnitudesoftware.wd1.myworkdayjobs.com/External" />
    <meta property="og:title" content="Careers" />
    <meta
      property="og:description"
      content="insightsoftware is a global provider of reporting, analytics, and performance management solutions."
    />
    <script src="/assets/cx-jobs.min.js"></script>
    <script>
      window.workday = { tenant: "magnitudesoftware", siteId: "External" }
    </script>
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/insightsoftware.workday/script.js')
  } catch {
    assert.fail('Expected insightsoftware scraper module at ../../scraper/insightsoftware.workday/script.js')
  }
}

test('insightsoftware company decoration retains native Workday inventory authority', async t => {
  const provider = await loadModule()
  await assertMappedInventoryEvidence(t, jobs => provider.createInsightsoftwareScraper({
    workdayRunner: async () => jobs,
  }).run({ fetchPage: async url => {
    if (url === provider.CAREERS_URL) return { status: 200, url, html: currentEmptyCareersHtml }
    if (url === provider.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
    throw new Error(`Unexpected inventory fixture URL: ${url}`)
  } }), { surface: provider.WORKDAY_BOARD_URL,
    job: { title: 'Engineer', jobId: 'R-2131', country: 'India' } })
})

test('insightsoftware helpers stay pinned to the verified first-party careers shell and direct Workday board', async () => {
  const insightsoftware = await loadModule()

  assert.equal(insightsoftware.SOURCE, 'insightsoftware')
  assert.equal(insightsoftware.COMPANY, 'insightsoftware')
  assert.equal(insightsoftware.CAREERS_URL, 'https://insightsoftware.com/careers/')
  assert.equal(insightsoftware.WORKDAY_TENANT_HOST, 'https://magnitudesoftware.wd1.myworkdayjobs.com/')
  assert.equal(insightsoftware.WORKDAY_BOARD_URL, 'https://magnitudesoftware.wd1.myworkdayjobs.com/External')
  assert.equal(insightsoftware.VERIFIED_ON, '2026-08-01')
  assert.equal(insightsoftware.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(insightsoftware.hasOfficialCareersSignal(currentEmptyCareersHtml), true)
  assert.equal(insightsoftware.hasOfficialWorkdayBoardSignal(workdayBoardHtml), true)
  assert.deepEqual(insightsoftware.buildScraperOptions(), {
    company: 'insightsoftware',
    baseUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'insightsoftware',
    scraperDir: insightsoftware.buildScraperOptions().scraperDir,
  })
  assert.deepEqual(
    insightsoftware.extractIndiaJobsFromCareersHtml(careersPageHtml, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Customer Success Analyst',
        company: 'insightsoftware',
        department: null,
        location: 'India - Hyderabad',
        city: 'Hyderabad',
        country: 'India',
        sourceUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad/Customer-Success-Analyst_R-2131',
        applyUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad/Customer-Success-Analyst_R-2131/apply',
        jobId: 'R-2131',
        requisitionId: 'R-2131',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'insightsoftware',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad/Customer-Success-Analyst_R-2131',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Director - Engineering',
        company: 'insightsoftware',
        department: null,
        location: 'India - Hyderabad - Remote',
        city: 'Hyderabad',
        country: 'India',
        sourceUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad---Remote/Director---Engineering_R-1904',
        applyUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad---Remote/Director---Engineering_R-1904/apply',
        jobId: 'R-1904',
        requisitionId: 'R-1904',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'Remote',
        source: 'insightsoftware',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Hyderabad---Remote/Director---Engineering_R-1904',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Senior Manager, Engineering',
        company: 'insightsoftware',
        department: null,
        location: 'India - Bangalore',
        city: 'Bangalore',
        country: 'India',
        sourceUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Bangalore/Senior-Manager--Engineering_R-2106',
        applyUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Bangalore/Senior-Manager--Engineering_R-2106/apply',
        jobId: 'R-2106',
        requisitionId: 'R-2106',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'insightsoftware',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/insightsoftware/job/India---Bangalore/Senior-Manager--Engineering_R-2106',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('insightsoftware run validates the first-party careers shell and delegates to the direct public Workday board', async () => {
  const insightsoftware = await loadModule()
  const requestedUrls = []

  const jobs = await insightsoftware.createInsightsoftwareScraper({
    now: () => FIXED_SCRAPED_AT,
    workdayRunner: async (options) => [
      {
        title: 'HR Business Partner',
        location: 'India - Hyderabad',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Hyderabad/HR-Business-Partner_REQ000983',
        source: 'insightsoftware',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
      {
        title: 'Lead Software Engineer',
        location: 'India - Bangalore - Remote',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Bangalore---Remote/Lead-Software-Engineer_REQ000848',
        source: 'insightsoftware',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
    ],
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === insightsoftware.CAREERS_URL) return { status: 200, url, html: currentEmptyCareersHtml }
      if (url === insightsoftware.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
      throw new Error(`Unexpected insightsoftware URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [insightsoftware.CAREERS_URL, insightsoftware.WORKDAY_BOARD_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.location,
      job.companyCareerPage,
      job.companyDomain,
      job.atsPlatform,
      job.runnerOptions,
    ]),
    [
      [
        'HR Business Partner',
        'India - Hyderabad',
        'https://insightsoftware.com/careers/',
        'insightsoftware.com',
        'workday',
        insightsoftware.buildScraperOptions(),
      ],
      [
        'Lead Software Engineer',
        'India - Bangalore - Remote',
        'https://insightsoftware.com/careers/',
        'insightsoftware.com',
        'workday',
        insightsoftware.buildScraperOptions(),
      ],
    ],
  )
})

test('insightsoftware fails closed when the verified first-party careers contract drifts', async () => {
  const insightsoftware = await loadModule()

  await assert.rejects(
    insightsoftware.createInsightsoftwareScraper().run({
      fetchPage: async () => ({ status: 200, url: insightsoftware.CAREERS_URL, html: '<html><body><h1>Unexpected</h1></body></html>' }),
    }),
    /verified insightsoftware careers page/i,
  )

  const jobs = await insightsoftware.createInsightsoftwareScraper({
    workdayRunner: async () => [{ title: 'Lead/Manager' }],
  }).run({
    fetchPage: async (url) => {
      if (url === insightsoftware.CAREERS_URL) {
        return {
          status: 504,
          url,
          html: '<html><body><h1>ERROR: The request could not be satisfied</h1><p>504 Gateway Timeout</p></body></html>',
        }
      }
      if (url === insightsoftware.WORKDAY_BOARD_URL) return { status: 200, url, html: workdayBoardHtml }
      throw new Error(`Unexpected insightsoftware URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Lead/Manager',
      companyCareerPage: 'https://insightsoftware.com/careers/',
      companyDomain: 'insightsoftware.com',
      atsPlatform: 'workday',
      scrapedAt: jobs[0].scrapedAt,
    },
  ])

  await assert.rejects(
    insightsoftware.createInsightsoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === insightsoftware.CAREERS_URL) {
          return { status: 200, url, html: currentEmptyCareersHtml }
        }
        if (url === insightsoftware.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }
        throw new Error(`Unexpected insightsoftware URL: ${url}`)
      },
    }),
    /verified insightsoftware public Workday board/i,
  )
})
