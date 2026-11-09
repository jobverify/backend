import assert from 'node:assert/strict'
import test from 'node:test'

const loadEnfusionModule = async () => {
  try {
    return await import('../../scraper/enfusion.workday/script.js')
  } catch {
    assert.fail('Expected Enfusion scraper module at ../../scraper/enfusion.workday/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Unified Front-to-Back Investment Management Platform | Clearwater</title>
  </head>
  <body>
    <nav>
      <a href="https://cwan.com/products/enfusion/">Enfusion by Clearwater</a>
      <a href="https://cwan.com/company/careers/">Careers</a>
      <a href="https://webapp.enfusionsystems.com/">Enfusion by Clearwater Login</a>
    </nav>
    <main>
      <h1>Transform investment management</h1>
      <p>Clearwater delivers a unified front-to-back platform.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers in Investment Technology | Clearwater</title>
    <link rel="canonical" href="https://cwan.com/company/careers/">
  </head>
  <body>
    <nav>
      <a href="https://cwan.com/products/enfusion/">Enfusion by Clearwater</a>
    </nav>
    <main>
      <div class="WORKDAY">
        <form id="workday-filter"></form>
        <div id="workday-feed"></div>
      </div>
      <script src="https://cwan.com/wp-content/themes/wp-clearwater/blocks/workday/script.js?ver=556e0cc75511"></script>
    </main>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers">
    <meta property="og:title" content="Careers">
    <script>
      window.workday = {
        tenant: "clearwateranalytics",
        siteId: "Clearwater_Analytics_Careers"
      };
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const jobsPayload = {
  Job_Posting: [
    {
      Job_Posting_Data: {
        Job_Posting_Title: 'Subject Matter Expert -Client Servicing ( Static Data )',
        Job_Posting_Description:
          '<p>The Static Data position is responsible for setting up various aspects of the client data on to the Enfusion platform such as user setup, fund structure, account and general ledger setups.</p>',
        External_Job_Path:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911',
        External_Apply_URL:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911/apply',
        Job_Requisition_ID: 'R11911',
        Job_Posting_Location_Data: {
          Primary_Location_Reference: {
            ID: ['71c813351f2701', 'LOC-Bengaluru Office'],
          },
        },
        Job_Family_Reference: {
          ID: ['71c813351f2701', 'Client Servicing'],
        },
        Time_Type_Reference: {
          ID: ['903f52154e6201', 'Full_time'],
        },
        Job_Posting_Start_Date: '2026-07-13',
      },
    },
    {
      Job_Posting_Data: {
        Job_Posting_Title: 'Business Development Representative',
        Job_Posting_Description:
          '<p>Join the CWAN Enfusion platform team and support business growth across regions.</p>',
        External_Job_Path:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---New-York/Business-Development-Representative_R20000',
        External_Apply_URL:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---New-York/Business-Development-Representative_R20000/apply',
        Job_Requisition_ID: 'R20000',
        Job_Posting_Location_Data: {
          Primary_Location_Reference: {
            ID: ['71c813351f2701', 'LOC-New York Office'],
          },
        },
        Job_Family_Reference: {
          ID: ['71c813351f2701', 'Sales'],
        },
        Time_Type_Reference: {
          ID: ['903f52154e6201', 'Full_time'],
        },
        Job_Posting_Start_Date: '2026-07-12',
      },
    },
    {
      Job_Posting_Data: {
        Job_Posting_Title: 'Software Development Engineer',
        Job_Posting_Description:
          '<p>Clearwater Analytics spans a spectrum of responsibilities with a focus on designing software systems.</p>',
        External_Job_Path:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Noida/Software-Development-Engineer_JR100508',
        External_Apply_URL:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Noida/Software-Development-Engineer_JR100508/apply',
        Job_Requisition_ID: 'JR100508',
        Job_Posting_Location_Data: {
          Primary_Location_Reference: {
            ID: ['71c813351f2701', 'LOC-India Office'],
          },
        },
        Job_Family_Reference: {
          ID: ['71c813351f2701', 'Software Development'],
        },
        Time_Type_Reference: {
          ID: ['903f52154e6201', 'Full_time'],
        },
        Job_Posting_Start_Date: '2026-07-10',
      },
    },
  ],
}

test('Enfusion scraper pins the verified Clearwater handoff and extracts only India Enfusion jobs', async () => {
  const enfusion = await loadEnfusionModule()

  assert.equal(enfusion.SOURCE, 'enfusion')
  assert.equal(enfusion.COMPANY, 'Enfusion')
  assert.equal(enfusion.OFFICIAL_BRAND_NAME, 'Enfusion by Clearwater')
  assert.equal(enfusion.VERIFIED_ON, '2026-07-15')
  assert.equal(enfusion.ENFUSION_HOMEPAGE_URL, 'https://enfusion.com/')
  assert.equal(enfusion.OFFICIAL_HOMEPAGE_URL, 'https://cwan.com/')
  assert.equal(enfusion.CAREERS_URL, 'https://cwan.com/company/careers/')
  assert.equal(
    enfusion.JOBS_API_URL,
    'https://cwan.com/wp-content/themes/wp-clearwater/blocks/workday/api.php',
  )
  assert.equal(
    enfusion.WORKDAY_BOARD_URL,
    'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers',
  )
  assert.equal(enfusion.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(enfusion.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    enfusion.hasOfficialWorkdayBoardSignal({
      status: 200,
      url: enfusion.WORKDAY_BOARD_URL,
      html: workdayBoardHtml,
    }),
    true,
  )
  assert.equal(
    enfusion.isEnfusionPosting(jobsPayload.Job_Posting[0]),
    true,
  )
  assert.equal(
    enfusion.isEnfusionPosting(jobsPayload.Job_Posting[2]),
    false,
  )
  assert.equal(enfusion.isIndiaLocationReference('LOC-Bengaluru Office'), true)
  assert.equal(enfusion.isIndiaLocationReference('LOC-New York Office'), false)

  assert.deepEqual(
    enfusion.extractEnfusionIndiaJobsFromPayload(jobsPayload, '2026-07-15T00:00:00.000Z'),
    [
      {
        jobId: 'R11911',
        title: 'Subject Matter Expert -Client Servicing ( Static Data )',
        company: 'Enfusion',
        department: 'Client Servicing',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        state: null,
        country: 'India',
        sourceUrl:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911',
        applyUrl:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911/apply',
        employmentType: 'Full time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-13',
        closingDate: null,
        jobDescription:
          'The Static Data position is responsible for setting up various aspects of the client data on to the Enfusion platform such as user setup, fund structure, account and general ledger setups.',
        requisitionId: 'R11911',
        source: 'enfusion',
        link:
          'https://clearwateranalytics.wd1.myworkdayjobs.com/Clearwater_Analytics_Careers/job/Office---Bengaluru/Sr-Subject-Matter-Expert-Implementation----Static-Data--_R11911/apply',
        scrapedAt: '2026-07-15T00:00:00.000Z',
      },
    ],
  )
})

test('Enfusion run validates the verified public surfaces and returns only India Enfusion jobs', async () => {
  const enfusion = await loadEnfusionModule()
  const requestedUrls = []

  const jobs = await enfusion.createEnfusionScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
        return { status: 200, url: enfusion.OFFICIAL_HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === enfusion.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === enfusion.WORKDAY_BOARD_URL) {
        return { status: 200, url, html: workdayBoardHtml }
      }

      throw new Error(`Unexpected Enfusion page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, enfusion.JOBS_API_URL)
      return jobsPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    enfusion.ENFUSION_HOMEPAGE_URL,
    enfusion.CAREERS_URL,
    enfusion.WORKDAY_BOARD_URL,
    enfusion.JOBS_API_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Subject Matter Expert -Client Servicing ( Static Data )')
  assert.equal(jobs[0].company, 'Enfusion')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].source, 'enfusion')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('Enfusion returns [] when the verified surfaces remain intact but there are no current India Enfusion postings', async () => {
  const enfusion = await loadEnfusionModule()

  const jobs = await enfusion.createEnfusionScraper().run({
    fetchPage: async (url) => {
      if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
        return { status: 200, url: enfusion.OFFICIAL_HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === enfusion.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === enfusion.WORKDAY_BOARD_URL) {
        return { status: 200, url, html: workdayBoardHtml }
      }

      throw new Error(`Unexpected Enfusion page URL: ${url}`)
    },
    fetchJson: async () => ({
      Job_Posting: [
        jobsPayload.Job_Posting[2],
      ],
    }),
  })

  assert.deepEqual(jobs, [])
})

test('Enfusion fails closed when the verified homepage redirect, careers shell, Workday board, or jobs payload drift', async () => {
  const enfusion = await loadEnfusionModule()

  await assert.rejects(
    enfusion.createEnfusionScraper().run({
      fetchPage: async (url) => {
        if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected Enfusion page URL: ${url}`)
      },
    }),
    /official enfusion homepage redirect/i,
  )

  await assert.rejects(
    enfusion.createEnfusionScraper().run({
      fetchPage: async (url) => {
        if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
          return { status: 200, url: enfusion.OFFICIAL_HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === enfusion.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1></body></html>' }
        }

        throw new Error(`Unexpected Enfusion page URL: ${url}`)
      },
    }),
    /verified first-party careers surface/i,
  )

  await assert.rejects(
    enfusion.createEnfusionScraper().run({
      fetchPage: async (url) => {
        if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
          return { status: 200, url: enfusion.OFFICIAL_HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === enfusion.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === enfusion.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: '<html><body><h1>Jobs</h1></body></html>' }
        }

        throw new Error(`Unexpected Enfusion page URL: ${url}`)
      },
    }),
    /verified public workday board/i,
  )

  await assert.rejects(
    enfusion.createEnfusionScraper().run({
      fetchPage: async (url) => {
        if (url === enfusion.ENFUSION_HOMEPAGE_URL) {
          return { status: 200, url: enfusion.OFFICIAL_HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === enfusion.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === enfusion.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: workdayBoardHtml }
        }

        throw new Error(`Unexpected Enfusion page URL: ${url}`)
      },
      fetchJson: async () => ({ jobs: [] }),
    }),
    /jobs api payload/i,
  )
})


for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('enfusion recognizes upstream Workday board failures for HTTP ' + status, async () => {
    const mod = await import('../../scraper/enfusion.workday/script.js')
    const {classifyScraperError} = await import('../utils/failureClassification.js')
    await assert.rejects(mod.createEnfusionScraper().run({
      fetchPage: async url => {
        if (url === mod.WORKDAY_BOARD_URL) return {status,url,html}
        if (url === mod.ENFUSION_HOMEPAGE_URL) return {status:200,url:mod.OFFICIAL_HOMEPAGE_URL,html:homepageHtml}; if (url === mod.CAREERS_URL) return {status:200,url,html:careersHtml}
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async () => assert.fail('Unavailable board must not request job listings'),
    }), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}
