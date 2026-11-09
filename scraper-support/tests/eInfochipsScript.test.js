import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const loadModule = async () => {
  try {
    return await import('../../scraper/einfochips.workday/script.js')
  } catch (error) {
    assert.fail(`Expected eInfochips scraper module at ../../scraper/einfochips.workday/script.js: ${error.message}`)
  }
}

test('eInfochips enriches India Workday jobs with public detail-page experience metadata', async () => {
  const einfochips = await loadModule()
  const requestedPages = []
  const requestedJsonBodies = []

  const officialCareersHtml = `
    <html>
      <head>
        <title>Join Us Today! - Career Opportunities and positions at eInfochips</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <p>Reshape the future of your career with us!</p>
        <p>Presence in 140 countries with Arrow Electronics</p>
        <a href="https://careers.arrow.com/us/en/search-results?keywords=einfochips">Apply Now</a>
      </body>
    </html>
  `

  const arrowSearchHtml = `
    <html>
      <head>
        <title>Search results | Find the available job openings at Arrow Electronics</title>
      </head>
      <body>
        <script>
          phApp.ddo = {"keywords":"einfochips"}
        </script>
        <a href="https://arrow.wd1.myworkdayjobs.com/en-US/AC">Workday board</a>
      </body>
    </html>
  `

  const workdayBoardHtml = `
    <html>
      <head>
        <link rel="canonical" href="https://arrow.wd1.myworkdayjobs.com/AC">
      </head>
      <body>
        <script>
          window.workday = window.workday
          window.workday = {
            tenant: "arrow",
            siteId: "AC",
            appName: "cxs"
          }
        </script>
      </body>
    </html>
  `

  const indiaCountryFacetId = einfochips.VERIFIED_INDIA_COUNTRY_FACET_ID
  const detailPageHtmlByUrl = {
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Pune-India/Automotive-Testing-Senior-Engineer-Pune_R236360': `
      <html>
        <head>
          <meta
            name="description"
            property="og:description"
            content="Position: Automotive Testing_Senior Engineer_Pune Job Description: Good in Automotive Domain. Experience / Education: Typically requires a 4 year degree and a minimum of 5 years of related experience; or an advanced degree without experience; or equivalent work experience. Location: IN-MH-Pune, India-Magarpatta City-Unit B (eInfochips) Time Type: Full time Job Category: Engineering Services"
          >
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "description": "Position: Automotive Testing_Senior Engineer_Pune Job Description: Good in Automotive Domain. Experience / Education: Typically requires a 4 year degree and a minimum of 5 years of related experience; or an advanced degree without experience; or equivalent work experience. Location: IN-MH-Pune, India-Magarpatta City-Unit B (eInfochips) Time Type: Full time Job Category: Engineering Services",
              "datePosted": "2026-07-20",
              "identifier": {
                "@type": "PropertyValue",
                "value": "R236360"
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `,
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449': `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "description": "Position: Senior Engineer - Data Engineer Job Description: Build real-time cloud software systems. Qualifications: 2-5 years of experience in data engineering, ETL pipelines, and cloud analytics. Location: IN-GJ-Ahmedabad, India (eInfochips) Time Type: Full time Job Category: Engineering Services",
              "datePosted": "2026-07-18",
              "identifier": {
                "@type": "PropertyValue",
                "value": "R232449"
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `,
  }

  const jobs = await einfochips.createEInfochipsScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === einfochips.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === einfochips.ARROW_SEARCH_URL) {
        return {
          status: 200,
          url,
          html: arrowSearchHtml,
        }
      }

      if (url === einfochips.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: workdayBoardHtml,
        }
      }

      if (detailPageHtmlByUrl[url]) {
        return {
          status: 200,
          url,
          html: detailPageHtmlByUrl[url],
        }
      }

      throw new Error(`Unexpected eInfochips page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, einfochips.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))

      if (requestedJsonBodies.length === 1) {
        return {
          total: 2,
          jobPostings: [],
          facets: [
            {
              facetParameter: 'Location_Country',
              values: [
                { descriptor: 'India', id: indiaCountryFacetId, count: 2 },
                { descriptor: 'United States', id: 'us-facet-id', count: 10 },
              ],
            },
          ],
        }
      }

      return {
        total: 2,
        jobPostings: [
          {
            title: 'Automotive Testing_Senior Engineer_Pune',
            externalPath: '/job/Pune-India/Automotive-Testing-Senior-Engineer-Pune_R236360',
            locationsText: 'Pune, India',
            postedOn: 'Posted 10 Days Ago',
            bulletFields: ['R236360'],
            timeType: 'Full time',
          },
          {
            title: 'Senior Engineer - Data Engineer',
            externalPath: '/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449',
            locationsText: 'Ahmedabad, India',
            postedOn: 'Posted 12 Days Ago',
            bulletFields: ['R232449'],
            timeType: 'Full time',
          },
        ],
      }
    },
  })

  assert.deepEqual(requestedPages, [
    einfochips.CAREERS_URL,
    einfochips.ARROW_SEARCH_URL,
    einfochips.WORKDAY_BOARD_URL,
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Pune-India/Automotive-Testing-Senior-Engineer-Pune_R236360',
    'https://arrow.wd1.myworkdayjobs.com/AC/job/Ahmedabad-India/Senior-Engineer--Level-1---Data-Engineer_R232449',
  ])
  assert.deepEqual(requestedJsonBodies, [
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: 'einfochips',
    },
    {
      appliedFacets: {
        Location_Country: [indiaCountryFacetId],
      },
      limit: 20,
      offset: 0,
      searchText: 'einfochips',
    },
  ])

  const automotiveTesting = jobs.find((job) => job.requisitionId === 'R236360')
  const dataEngineer = jobs.find((job) => job.requisitionId === 'R232449')

  assert.equal(automotiveTesting?.experienceRequired, '5+ years')
  assert.match(automotiveTesting?.jobDescription || '', /minimum of 5 years of related experience/i)
  assert.equal(automotiveTesting?.postingDate, '2026-07-20')
  assert.equal(dataEngineer?.experienceRequired, '2-5 years')
  assert.match(dataEngineer?.minimumQualification || '', /cloud analytics/i)
  assert.equal(dataEngineer?.postingDate, '2026-07-18')
})


const maintenanceCareersHtml = `
    <html>
      <head>
        <title>Join Us Today! - Career Opportunities and positions at eInfochips</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <p>Reshape the future of your career with us!</p>
        <p>Presence in 140 countries with Arrow Electronics</p>
        <a href="https://careers.arrow.com/us/en/search-results?keywords=einfochips">Apply Now</a>
      </body>
    </html>
  `
const maintenanceArrowHtml = `
    <html>
      <head>
        <title>Search results | Find the available job openings at Arrow Electronics</title>
      </head>
      <body>
        <script>
          phApp.ddo = {"keywords":"einfochips"}
        </script>
        <a href="https://arrow.wd1.myworkdayjobs.com/en-US/AC">Workday board</a>
      </body>
    </html>
  `

for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('einfochips recognizes upstream Workday board failures for HTTP ' + status, async () => {
    const mod = await import('../../scraper/einfochips.workday/script.js')
    const {classifyScraperError} = await import('../utils/failureClassification.js')
    await assert.rejects(mod.createEInfochipsScraper().run({
      fetchPage: async url => {
        if (url === mod.WORKDAY_BOARD_URL) return {status,url,html}
        if (url === mod.CAREERS_URL) return {status:200,url,html:maintenanceCareersHtml}; if (url === mod.ARROW_SEARCH_URL) return {status:200,url,html:maintenanceArrowHtml}
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async () => assert.fail('Unavailable board must not request job listings'),
    }), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}
