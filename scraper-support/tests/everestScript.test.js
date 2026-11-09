import assert from 'node:assert/strict'
import test from 'node:test'

const homepagePage = {
  status: 200,
  url: 'https://www.everestglobal.com/us-en',
  html: `
    <!DOCTYPE html>
    <html lang="en-US">
      <head>
        <title>Welcome to Everest | Everest</title>
        <meta name="description" content="At Everest, we underwrite opportunity for all stakeholders with protection and peace of mind in an increasingly complex and uncertain world." />
        <link rel="canonical" href="https://www.everestglobal.com/us-en" />
      </head>
      <body>
        <main>
          <p>We underwrite opportunity.</p>
          <a href="/us-en/career-opportunities/working-at-everest">Working at Everest</a>
          <a href="/us-en/career-opportunities/our-culture">Our Culture</a>
        </main>
        <footer>
          <a href="/us-en/about-us">About Us</a>
          <a href="/us-en/our-offer/contact-us">Contact Us</a>
          <a href="/us-en/career-opportunities">Careers</a>
        </footer>
      </body>
    </html>
  `,
}

const careersPage = {
  status: 200,
  url: 'https://www.everestglobal.com/us-en/career-opportunities/overview',
  html: `
    <!DOCTYPE html>
    <html lang="en-US">
      <head>
        <title>Careers | Everest</title>
        <link rel="canonical" href="https://www.everestglobal.com/us-en/career-opportunities/overview" />
      </head>
      <body>
        <h1>Your opportunity <span>starts here</span></h1>
        <a href="https://wd5.myworkdaysite.com/recruiting/everestre/careers" target="_blank">View Job Openings</a>
        <p>Ready to take your next step?</p>
        <h2>Where could your career take you?</h2>
      </body>
    </html>
  `,
}

const workdayBoardPage = {
  status: 200,
  url: 'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
  html: `
    <!DOCTYPE html>
    <html lang="en-US">
      <head>
        <meta property="og:title" content="Careers" />
        <meta
          property="og:description"
          content="Beware of recruitment fraud. EVEREST is a leading international reinsurance and insurance group with an extensive distribution network that spans five continents."
        />
        <meta property="og:url" content="https://wd5.myworkdaysite.com/recruiting/everestre/careers" />
      </head>
      <body>
        <script>
          window.workday = { tenant: "everestre", siteId: "careers", postingAvailable: null };
        </script>
      </body>
    </html>
  `,
}

const singaporeDetailHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta property="og:title" content="Associate Underwriter, Everest Rotational Development Programme - Singapore" />
      <script type="application/ld+json">
        {
          "@context":"http://schema.org",
          "@type":"JobPosting",
          "title":"Associate Underwriter, Everest Rotational Development Programme - Singapore",
          "identifier":{"@type":"PropertyValue","value":"R6960"},
          "datePosted":"2026-07-03",
          "description":"Title: Associate Underwriter, Everest Rotational Development Programme - Singapore",
          "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"Singapore","addressLocality":"Singapore"}}
        }
      </script>
    </head>
    <body>
      <dl><dt>Locations</dt><dd>Singapore</dd></dl>
      <dl><dt>Department</dt><dd>Operations</dd></dl>
    </body>
  </html>
`

const groupedNonIndiaDetailHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <body>
      <dl>
        <dt>Locations</dt>
        <dd>Dublin, Ireland</dd>
        <dd>London</dd>
      </dl>
    </body>
  </html>
`

const directIndiaDetailHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <script type="application/ld+json">
        {
          "@context":"http://schema.org",
          "@type":"JobPosting",
          "title":"Senior Analyst",
          "identifier":{"@type":"PropertyValue","value":"R8000"},
          "datePosted":"2026-07-15",
          "description":"Maintain risk analytics platforms. Required qualifications: three years of SQL and Python experience. Preferred qualifications: insurance data experience."
        }
      </script>
    </head>
    <body>
      <dl><dt>Locations</dt><dd>Mumbai, India</dd></dl>
      <dl><dt>Department</dt><dd>Analytics</dd></dl>
    </body>
  </html>
`

const groupedIndiaDetailHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <script type="application/ld+json">
        {
          "@context":"http://schema.org",
          "@type":"JobPosting",
          "title":"Platform Engineer",
          "identifier":{"@type":"PropertyValue","value":"R8001"},
          "datePosted":"2026-07-12",
          "description":"Build and operate public risk platforms. Required qualifications: three years of Linux and Python experience. Preferred qualifications: cloud operations experience."
        }
      </script>
    </head>
    <body>
      <dl>
        <dt>Locations</dt>
        <dd>Bengaluru, India</dd>
        <dd>Singapore</dd>
      </dl>
      <dl><dt>Department</dt><dd>Technology</dd></dl>
    </body>
  </html>
`

const zeroIndiaJobsPayload = {
  total: 2,
  jobPostings: [
    {
      title: 'Associate Underwriter, Everest Rotational Development Programme - Singapore',
      externalPath: '/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960',
      locationsText: 'Singapore',
      postedOn: 'Posted 11 Days Ago',
      bulletFields: ['R6960'],
    },
    {
      title: 'Senior Risk Manager',
      externalPath: '/job/Dublin-Ireland/Senior-Risk-Manager_R7208',
      locationsText: '2 Locations',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['R7208'],
    },
  ],
}

const indiaJobsPayload = {
  total: 2,
  jobPostings: [
    {
      title: 'Senior Analyst',
      externalPath: '/job/Mumbai-India/Senior-Analyst_R8000',
      locationsText: 'Mumbai, India',
      postedOn: 'Posted Today',
      bulletFields: ['R8000'],
    },
    {
      title: 'Platform Engineer',
      externalPath: '/job/Singapore/Platform-Engineer_R8001',
      locationsText: '2 Locations',
      postedOn: 'Posted 3 Days Ago',
      bulletFields: ['R8001'],
    },
  ],
}

const malformedPayload = { total: 'unexpected', jobPostings: null }

const loadEverestModule = async () => {
  try {
    return await import('../../scraper/everest.workday/script.js')
  } catch {
    assert.fail('Expected Everest scraper module at ../../scraper/everest.workday/script.js')
  }
}

test('Everest helpers stay pinned to the verified careers handoff and official Workday board', async () => {
  const everest = await loadEverestModule()

  assert.equal(everest.SOURCE, 'everest')
  assert.equal(everest.COMPANY, 'Everest')
  assert.equal(everest.OFFICIAL_BRAND_NAME, 'Everest')
  assert.equal(everest.VERIFIED_ON, '2026-08-01')
  assert.equal(everest.HOMEPAGE_URL, 'https://www.everestglobal.com/')
  assert.equal(everest.CAREERS_PAGE_URL, 'https://www.everestglobal.com/careers/')
  assert.equal(
    everest.CAREERS_OVERVIEW_URL,
    'https://www.everestglobal.com/us-en/career-opportunities/overview',
  )
  assert.equal(
    everest.WORKDAY_BOARD_URL,
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
  )
  assert.equal(
    everest.JOBS_API_URL,
    'https://wd5.myworkdaysite.com/wday/cxs/everestre/careers/jobs',
  )
  assert.equal(everest.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(everest.hasOfficialCareersSignal(careersPage), true)
  assert.equal(
    everest.extractVerifiedWorkdayBoardUrl(careersPage.html),
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
  )
  assert.equal(everest.hasOfficialWorkdayBoardSignal(workdayBoardPage), true)
  assert.equal(everest.isIndiaLocation('Mumbai, India'), true)
  assert.equal(everest.isIndiaLocation('Bengaluru, India'), true)
  assert.equal(everest.isIndiaLocation('Singapore'), false)
  assert.equal(everest.isGroupedLocationLabel('2 Locations'), true)
  assert.equal(everest.isGroupedLocationLabel('Singapore'), false)
  assert.equal(
    everest.buildJobDetailUrl('/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960'),
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960',
  )
})

test('Everest returns [] for the verified official surface while the public Workday source has zero India matches', async () => {
  const everest = await loadEverestModule()
  const pageUrls = []
  const apiCalls = []

  const jobs = await everest.createEverestScraper({ maxPages: 1 }).run({
    fetchPage: async (url) => {
      pageUrls.push(url)

      if (url === everest.HOMEPAGE_URL) return homepagePage
      if (url === everest.CAREERS_PAGE_URL) return careersPage
      if (url === everest.WORKDAY_BOARD_URL) return workdayBoardPage
      if (url === `${everest.WORKDAY_BOARD_URL}/job/Dublin-Ireland/Senior-Risk-Manager_R7208`) {
        return { status: 200, url, html: groupedNonIndiaDetailHtml }
      }
      if (url === `${everest.WORKDAY_BOARD_URL}/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960`) {
        return { status: 200, url, html: singaporeDetailHtml }
      }

      throw new Error(`Unexpected Everest page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      apiCalls.push({ url, body })
      assert.equal(url, everest.JOBS_API_URL)
      assert.equal(body, everest.buildJobsRequestBody({ offset: 0 }))
      return zeroIndiaJobsPayload
    },
  })

  assert.deepEqual(pageUrls, [
    everest.HOMEPAGE_URL,
    everest.CAREERS_PAGE_URL,
    everest.WORKDAY_BOARD_URL,
    `${everest.WORKDAY_BOARD_URL}/job/Dublin-Ireland/Senior-Risk-Manager_R7208`,
    everest.CAREERS_PAGE_URL,
  ])
  assert.equal(apiCalls.length, 2)
  assert.deepEqual(jobs, [])
})

test('Everest extracts direct and grouped India matches from the official Workday payload', async () => {
  const everest = await loadEverestModule()

  const jobs = await everest.createEverestScraper({ maxPages: 1 }).run({
    fetchPage: async (url) => {
      if (url === everest.HOMEPAGE_URL) return homepagePage
      if (url === everest.CAREERS_PAGE_URL) return careersPage
      if (url === everest.WORKDAY_BOARD_URL) return workdayBoardPage
      if (url === `${everest.WORKDAY_BOARD_URL}/job/Mumbai-India/Senior-Analyst_R8000`) {
        return { status: 200, url, html: directIndiaDetailHtml }
      }
      if (url === `${everest.WORKDAY_BOARD_URL}/job/Singapore/Platform-Engineer_R8001`) {
        return { status: 200, url, html: groupedIndiaDetailHtml }
      }

      throw new Error(`Unexpected Everest page URL: ${url}`)
    },
    fetchJson: async () => indiaJobsPayload,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Senior Analyst')
  assert.equal(jobs[0].location, 'Mumbai, India')
  assert.equal(jobs[0].requisitionId, 'R8000')
  assert.equal(jobs[0].source, 'everest')
  assert.equal(jobs[1].title, 'Platform Engineer')
  assert.equal(jobs[1].location, 'Bengaluru, India')
  assert.deepEqual(jobs[1].locations, ['Bengaluru, India', 'Singapore'])
  assert.equal(jobs[1].requisitionId, 'R8001')
})

test('Everest fails closed when the verified first-party handoff or Workday payload changes materially', async () => {
  const everest = await loadEverestModule()

  await assert.rejects(
    everest.createEverestScraper().run({
      fetchPage: async (url) => {
        if (url === everest.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Everest page URL: ${url}`)
      },
    }),
    /homepage changed materially/i,
  )

  await assert.rejects(
    everest.createEverestScraper().run({
      fetchPage: async (url) => {
        if (url === everest.HOMEPAGE_URL) return homepagePage
        if (url === everest.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url: careersPage.url,
            html: careersPage.html.replace(
              'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
              'https://example.com/other-board',
            ),
          }
        }

        throw new Error(`Unexpected Everest page URL: ${url}`)
      },
    }),
    /Workday handoff changed materially/i,
  )

  await assert.rejects(
    everest.createEverestScraper().run({
      fetchPage: async (url) => {
        if (url === everest.HOMEPAGE_URL) return homepagePage
        if (url === everest.CAREERS_PAGE_URL) return careersPage
        if (url === everest.WORKDAY_BOARD_URL) {
          return { status: 200, url, html: '<html><head><title>Other</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Everest page URL: ${url}`)
      },
    }),
    /Workday board changed materially/i,
  )

  await assert.rejects(
    everest.createEverestScraper({ maxPages: 1 }).run({
      fetchPage: async (url) => {
        if (url === everest.HOMEPAGE_URL) return homepagePage
        if (url === everest.CAREERS_PAGE_URL) return careersPage
        if (url === everest.WORKDAY_BOARD_URL) return workdayBoardPage

        throw new Error(`Unexpected Everest page URL: ${url}`)
      },
      fetchJson: async () => malformedPayload,
    }),
    /jobs api payload changed materially/i,
  )
})


for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('everest recognizes upstream Workday board failures for HTTP ' + status, async () => {
    const mod = await import('../../scraper/everest.workday/script.js')
    const {classifyScraperError} = await import('../utils/failureClassification.js')
    await assert.rejects(mod.createEverestScraper().run({
      fetchPage: async url => {
        if (url === mod.WORKDAY_BOARD_URL) return {status,url,html}
        if (url === mod.HOMEPAGE_URL) return homepagePage; if (url === mod.CAREERS_PAGE_URL) return careersPage
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async () => assert.fail('Unavailable board must not request job listings'),
    }), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}
