import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMappedInventoryEvidence } from './helpers/assertMappedInventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const REDIRECTED_MAGNITUDE_PAGE = {
  status: 200,
  url: 'https://insightsoftware.com/magnitude/',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Magnitude | insightsoftware</title>
      </head>
      <body>
        <nav>
          <a href="https://insightsoftware.com/company/">Work With Us</a>
          <a href="https://insightsoftware.com/careers/">Careers</a>
        </nav>
        <main>
          <h1>Magnitude</h1>
          <p>Magnitude is now part of insightsoftware</p>
        </main>
      </body>
    </html>
  `,
}

const INDIA_CUSTOMER_SUCCESS_ROLE = {
  title: 'Customer Success Analyst',
  location: 'India - Hyderabad',
  department: 'Customer Success',
  detailUrl:
    'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad/Customer-Success-Analyst_R-2001',
}

const INDIA_ENGINEERING_ROLE = {
  title: 'Director - Engineering',
  location: 'India - Hyderabad - Remote',
  department: 'Engineering',
  detailUrl:
    'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad---Remote/Director---Engineering_R-2002',
}

const UNITED_STATES_ROLE = {
  title: 'Senior Technical Writer',
  location: 'United States - Remote',
  department: 'Product',
  detailUrl:
    'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/United-States---Remote/Senior-Technical-Writer_R-9999',
}

const buildCareersHtml = (roles) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | insightsoftware</title>
  </head>
  <body>
    <main>
      <h1>Current Job Openings</h1>
      <p>Learn more about our high-energy, high-performance global team.</p>
      <section aria-label="Location Filters">
        <button>India - Bangalore</button>
        <button>India - Bangalore - Remote</button>
        <button>India - Hyderabad</button>
        <button>India - Hyderabad - Remote</button>
        <button>India - Remote</button>
      </section>
      <section aria-label="Job Listings">
        ${roles.map((role) => `
          <div class="job-item" data-name="${role.title}" data-location="${role.location}" data-department="${role.department}">
            <div>
              <h3 class="fw-bold isw-wgignore">
                <a href="${role.detailUrl}" class="text-decoration-none">${role.title}</a>
              </h3>
              <span class="job-location">${role.location}</span>
            </div>
            <div>
              <a href="${role.detailUrl}" class="btn btn-primary btn-sm">View Job</a>
            </div>
          </div>
        `).join('\n')}
      </section>
    </main>
  </body>
</html>
`

const CURRENT_EMPTY_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | insightsoftware</title>
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

const WORKDAY_BOARD_HTML = `
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
    return await import('../../scraper/magnitudesoftware.workday/script.js')
  } catch {
    assert.fail('Expected Magnitude Software scraper module at ../../scraper/magnitudesoftware.workday/script.js')
  }
}

test('Magnitude company decoration retains native Workday inventory authority', async t => {
  const magnitude = await loadModule()
  await assertMappedInventoryEvidence(t, jobs => magnitude.createMagnitudeSoftwareScraper({
    workdayRunner: async () => jobs,
  }).run({ fetchPage: async url => {
    if (url === magnitude.HOMEPAGE_URL) return REDIRECTED_MAGNITUDE_PAGE
    if (url === magnitude.CAREERS_URL) return { status: 200, url, html: CURRENT_EMPTY_CAREERS_HTML }
    if (url === magnitude.WORKDAY_BOARD_URL) return { status: 200, url, html: WORKDAY_BOARD_HTML }
    throw new Error(`Unexpected inventory fixture URL: ${url}`)
  } }), { surface: magnitude.WORKDAY_BOARD_URL,
    job: { title: 'Engineer', jobId: 'REQ000983', country: 'India' } })
})

test('Magnitude Software helpers stay pinned to the verified homepage redirect, careers shell, and Workday board from Saturday, August 1, 2026', async () => {
  const magnitude = await loadModule()
  const careersHtml = buildCareersHtml([
    INDIA_CUSTOMER_SUCCESS_ROLE,
    INDIA_ENGINEERING_ROLE,
    UNITED_STATES_ROLE,
  ])

  assert.equal(magnitude.SOURCE, 'magnitudesoftware')
  assert.equal(magnitude.COMPANY, 'Magnitude Software')
  assert.equal(magnitude.HOMEPAGE_URL, 'https://www.magnitude.com/')
  assert.equal(magnitude.REDIRECT_COMPANY_URL, 'https://insightsoftware.com/magnitude/')
  assert.equal(magnitude.CAREERS_URL, 'https://insightsoftware.com/careers/')
  assert.equal(magnitude.WORKDAY_TENANT_HOST, 'https://magnitudesoftware.wd1.myworkdayjobs.com/')
  assert.equal(magnitude.WORKDAY_BOARD_URL, 'https://magnitudesoftware.wd1.myworkdayjobs.com/External')
  assert.equal(magnitude.VERIFIED_ON, '2026-08-01')
  assert.equal(magnitude.hasRedirectedMagnitudePageSignal(REDIRECTED_MAGNITUDE_PAGE), true)
  assert.equal(
    magnitude.hasRedirectedMagnitudePageSignal({
      ...REDIRECTED_MAGNITUDE_PAGE,
      url: 'https://www.insightsoftware.com/magnitude/',
      html: REDIRECTED_MAGNITUDE_PAGE.html.replace('Work With Us', 'Products'),
    }),
    true,
  )
  assert.equal(magnitude.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(magnitude.hasOfficialCareersSignal(CURRENT_EMPTY_CAREERS_HTML), true)
  assert.equal(magnitude.hasOfficialWorkdayBoardSignal(WORKDAY_BOARD_HTML), true)
  assert.deepEqual(magnitude.buildScraperOptions(), {
    company: 'Magnitude Software',
    baseUrl: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'magnitudesoftware',
    scraperDir: magnitude.buildScraperOptions().scraperDir,
  })
  assert.deepEqual(
    magnitude.extractIndiaJobsFromCareersHtml(careersHtml, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Customer Success Analyst',
        company: 'Magnitude Software',
        department: 'Customer Success',
        location: 'India - Hyderabad',
        city: 'Hyderabad',
        country: 'India',
        sourceUrl:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad/Customer-Success-Analyst_R-2001',
        applyUrl:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad/Customer-Success-Analyst_R-2001/apply',
        jobId: 'R-2001',
        requisitionId: 'R-2001',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'magnitudesoftware',
        link:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad/Customer-Success-Analyst_R-2001',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Director - Engineering',
        company: 'Magnitude Software',
        department: 'Engineering',
        location: 'India - Hyderabad - Remote',
        city: 'Hyderabad',
        country: 'India',
        sourceUrl:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad---Remote/Director---Engineering_R-2002',
        applyUrl:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad---Remote/Director---Engineering_R-2002/apply',
        jobId: 'R-2002',
        requisitionId: 'R-2002',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'Remote',
        source: 'magnitudesoftware',
        link:
          'https://magnitudesoftware.wd1.myworkdayjobs.com/en-US/External/job/India---Hyderabad---Remote/Director---Engineering_R-2002',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Magnitude Software run validates the verified first-party redirect and delegates to the direct public Workday board', async () => {
  const magnitude = await loadModule()
  const requestedUrls = []

  const jobs = await magnitude.createMagnitudeSoftwareScraper({
    now: () => FIXED_SCRAPED_AT,
    workdayRunner: async (options) => [
      {
        title: 'HR Business Partner',
        location: 'India - Hyderabad',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Hyderabad/HR-Business-Partner_REQ000983',
        source: 'magnitudesoftware',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
      {
        title: 'Lead Software Engineer',
        location: 'India - Bangalore - Remote',
        link: 'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Bangalore---Remote/Lead-Software-Engineer_REQ000848',
        source: 'magnitudesoftware',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
    ],
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === magnitude.HOMEPAGE_URL) return REDIRECTED_MAGNITUDE_PAGE
      if (url === magnitude.CAREERS_URL) return { status: 200, url, html: CURRENT_EMPTY_CAREERS_HTML }
      if (url === magnitude.WORKDAY_BOARD_URL) return { status: 200, url, html: WORKDAY_BOARD_HTML }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    magnitude.HOMEPAGE_URL,
    magnitude.CAREERS_URL,
    magnitude.WORKDAY_BOARD_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.location,
      job.source,
      job.link,
      job.companyCareerPage,
      job.companyDomain,
      job.atsPlatform,
      job.scrapedAt,
      job.runnerOptions,
    ]),
    [
      [
        'HR Business Partner',
        'India - Hyderabad',
        'magnitudesoftware',
        'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Hyderabad/HR-Business-Partner_REQ000983',
        'https://insightsoftware.com/careers/',
        'magnitude.com',
        'workday',
        FIXED_SCRAPED_AT,
        magnitude.buildScraperOptions(),
      ],
      [
        'Lead Software Engineer',
        'India - Bangalore - Remote',
        'magnitudesoftware',
        'https://magnitudesoftware.wd1.myworkdayjobs.com/External/job/India---Bangalore---Remote/Lead-Software-Engineer_REQ000848',
        'https://insightsoftware.com/careers/',
        'magnitude.com',
        'workday',
        FIXED_SCRAPED_AT,
        magnitude.buildScraperOptions(),
      ],
    ],
  )
})

test('Magnitude Software tolerates transient first-party careers outages when the direct public Workday board still verifies cleanly', async () => {
  const magnitude = await loadModule()

  const jobs = await magnitude.createMagnitudeSoftwareScraper({
    workdayRunner: async () => [{ title: 'Senior Database Administrator' }],
  }).run({
    fetchPage: async (url) => {
      if (url === magnitude.HOMEPAGE_URL) return REDIRECTED_MAGNITUDE_PAGE
      if (url === magnitude.CAREERS_URL) {
        return {
          status: 504,
          url,
          html: '<html><body><h1>ERROR: The request could not be satisfied</h1><p>504 Gateway Timeout</p></body></html>',
        }
      }
      if (url === magnitude.WORKDAY_BOARD_URL) return { status: 200, url, html: WORKDAY_BOARD_HTML }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Database Administrator',
      companyCareerPage: 'https://insightsoftware.com/careers/',
      companyDomain: 'magnitude.com',
      atsPlatform: 'workday',
      scrapedAt: jobs[0].scrapedAt,
    },
  ])
})

test('Magnitude Software fails closed when the verified redirect or first-party careers contract drifts', async () => {
  const magnitude = await loadModule()

  await assert.rejects(
    magnitude.createMagnitudeSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === magnitude.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Magnitude homepage redirect/i,
  )

  await assert.rejects(
    magnitude.createMagnitudeSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === magnitude.HOMEPAGE_URL) return REDIRECTED_MAGNITUDE_PAGE
        if (url === magnitude.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Jobs</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    magnitude.createMagnitudeSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === magnitude.HOMEPAGE_URL) return REDIRECTED_MAGNITUDE_PAGE
        if (url === magnitude.CAREERS_URL) {
          return { status: 200, url, html: CURRENT_EMPTY_CAREERS_HTML }
        }
        if (url === magnitude.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public Workday board/i,
  )
})
