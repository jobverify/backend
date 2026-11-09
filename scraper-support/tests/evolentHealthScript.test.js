import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <link rel="canonical" href="https://www.evolent.com/careers" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Global opportunities</h2>
      <p>
        Our international team helps propel our mission to transform health outcomes for the most
        complex and costly conditions. We’re hiring for a variety of roles in India and the
        Philippines, in nursing, IT, call center and more.
      </p>
      <a href="https://evolent.wd1.myworkdayjobs.com/External">Search openings</a>
      <p>
        We will always communicate with you directly through emails with an @evolent.com domain or
        via our Workday tracking system.
      </p>
    </main>
  </body>
</html>
`

const officialWorkdayBoardPage = {
  status: 200,
  url: 'https://evolent.wd1.myworkdayjobs.com/External',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <link rel="canonical" href="https://evolent.wd1.myworkdayjobs.com/External" />
        <meta name="title" property="og:title" content="Careers">
        <meta
          name="description"
          property="og:description"
          content="Don't see the dream job you are looking for? Drop off your contact information and resume and we will reach out to you if we find the perfect fit!"
        >
      </head>
      <body>
        <script>
          window.workday = {
            tenant: "evolent",
            siteId: "External"
          }
        </script>
        <div id="root"></div>
      </body>
    </html>
  `,
}

const unfilteredJobsPayload = {
  total: 42,
  jobPostings: [
    {
      title: 'Rheumatologist-Physician Reviewer-Radiology (Full-Time)',
      externalPath: '/job/Work-at-Home/Rheumatologist-Physician-Reviewer-Field-Medical-Director--Radiology--Full-Time-_JR-916339',
      locationsText: 'Work at Home',
      postedOn: 'Posted 27 Days Ago',
      bulletFields: ['JR-916339'],
      timeType: 'Full time',
    },
    {
      title: 'Sr SaaS Administrator, Enterprise Applications',
      externalPath: '/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
      locationsText: 'Pune',
      postedOn: 'Posted Yesterday',
      bulletFields: ['JR-916402'],
      timeType: 'Full time',
    },
  ],
  facets: [
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locations',
          descriptor: 'Locations',
          values: [
            {
              descriptor: 'Philippines',
              id: '538cf81fb9431001b25f1581dbe10000',
              count: 1,
            },
            {
              descriptor: 'Pune',
              id: '0d12f7baa1f9019decd79d9d7a8d9703',
              count: 10,
            },
            {
              descriptor: 'Work at Home',
              id: '31793f9d70b1101d001b8352e7646ae9',
              count: 32,
            },
          ],
        },
      ],
    },
  ],
}

const filteredIndiaJobsPayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Sr SaaS Administrator, Enterprise Applications',
      externalPath: '/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
      locationsText: 'Pune',
      postedOn: 'Posted Yesterday',
      bulletFields: ['JR-916402'],
      timeType: 'Full time',
    },
    {
      title: 'Associate Manager/Manager, FP&A',
      externalPath: '/job/Pune/Manager--FP-A_JR-916077',
      locationsText: 'Pune',
      postedOn: 'Posted 12 Days Ago',
      bulletFields: ['JR-916077'],
      timeType: 'Full time',
    },
    {
      title: 'Lead Tech Analyst, HR Information Systems',
      externalPath: '/job/Pune/Lead-Tech-Analyst--HR-Information-Systems_JR-916461',
      locationsText: 'Pune',
      postedOn: 'Posted 13 Days Ago',
      bulletFields: ['JR-916461'],
      timeType: 'Full time',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/evolenthealth.workday/script.js')
  } catch {
    assert.fail('Expected Evolent Health scraper module at ../../scraper/evolenthealth.workday/script.js')
  }
}

test('Evolent Health constants and parsers stay pinned to the verified careers and Workday Pune surface', async () => {
  const evolent = await loadModule()

  assert.equal(evolent.COMPANY_NAME, 'Evolent Health')
  assert.equal(evolent.OFFICIAL_BRAND_NAME, 'Evolent')
  assert.equal(evolent.SOURCE, 'evolenthealth')
  assert.equal(evolent.COUNTRY_FILTER, 'India')
  assert.equal(evolent.CAREERS_URL, 'https://www.evolent.com/careers')
  assert.equal(evolent.WORKDAY_BOARD_URL, 'https://evolent.wd1.myworkdayjobs.com/External')
  assert.equal(
    evolent.JOBS_API_URL,
    'https://evolent.wd1.myworkdayjobs.com/wday/cxs/evolent/External/jobs',
  )
  assert.deepEqual(evolent.VERIFIED_INDIA_LOCATION_DESCRIPTORS, ['Pune'])
  assert.equal(
    evolent.VERIFIED_INDIA_JOB_URL,
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
  )
  assert.equal(
    evolent.VERIFIED_INDIA_APPLY_URL,
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
  )
  assert.equal(evolent.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    evolent.extractVerifiedWorkdayBoardUrl(officialCareersHtml),
    'https://evolent.wd1.myworkdayjobs.com/External',
  )
  assert.equal(evolent.hasOfficialWorkdayBoardSignal(officialWorkdayBoardPage), true)
  assert.equal(evolent.isEvolentIndiaLocationDescriptor('Pune'), true)
  assert.equal(evolent.isEvolentIndiaLocationDescriptor('Work at Home'), false)
  assert.deepEqual(
    evolent.extractIndiaLocationFacetIds(unfilteredJobsPayload),
    ['0d12f7baa1f9019decd79d9d7a8d9703'],
  )
  assert.deepEqual(
    JSON.parse(evolent.buildUnfilteredJobsRequestBody({ offset: 0 })),
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )
  assert.deepEqual(
    JSON.parse(
      evolent.buildIndiaJobsRequestBody({
        offset: 20,
        locationFacetIds: ['0d12f7baa1f9019decd79d9d7a8d9703'],
      }),
    ),
    {
      appliedFacets: {
        locations: ['0d12f7baa1f9019decd79d9d7a8d9703'],
      },
      limit: 20,
      offset: 20,
      searchText: '',
    },
  )
  assert.deepEqual(
    evolent.extractJobsFromPayload(filteredIndiaJobsPayload, FIXED_SCRAPED_AT),
    [
      {
        jobId: 'JR-916402',
        title: 'Sr SaaS Administrator, Enterprise Applications',
        company: 'Evolent Health',
        department: null,
        location: 'Pune, India',
        city: 'Pune',
        state: null,
        country: 'India',
        sourceUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402',
        applyUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
        employmentType: 'Full time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Posted Yesterday',
        closingDate: null,
        jobDescription: null,
        requisitionId: 'JR-916402',
        source: 'evolenthealth',
        link: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'JR-916077',
        title: 'Associate Manager/Manager, FP&A',
        company: 'Evolent Health',
        department: null,
        location: 'Pune, India',
        city: 'Pune',
        state: null,
        country: 'India',
        sourceUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Manager--FP-A_JR-916077',
        applyUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Manager--FP-A_JR-916077/apply',
        employmentType: 'Full time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Posted 12 Days Ago',
        closingDate: null,
        jobDescription: null,
        requisitionId: 'JR-916077',
        source: 'evolenthealth',
        link: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Manager--FP-A_JR-916077/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'JR-916461',
        title: 'Lead Tech Analyst, HR Information Systems',
        company: 'Evolent Health',
        department: null,
        location: 'Pune, India',
        city: 'Pune',
        state: null,
        country: 'India',
        sourceUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Lead-Tech-Analyst--HR-Information-Systems_JR-916461',
        applyUrl: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Lead-Tech-Analyst--HR-Information-Systems_JR-916461/apply',
        employmentType: 'Full time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: 'Posted 13 Days Ago',
        closingDate: null,
        jobDescription: null,
        requisitionId: 'JR-916461',
        source: 'evolenthealth',
        link: 'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Lead-Tech-Analyst--HR-Information-Systems_JR-916461/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('run validates the first-party handoff and extracts Evolent Health Pune jobs from the verified location facet', async () => {
  const evolent = await loadModule()
  const requestedPages = []
  const requestedJsonBodies = []

  const jobs = await evolent.createEvolentHealthScraper({
    now: () => FIXED_SCRAPED_AT,
    maxPages: 1,
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === evolent.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === evolent.WORKDAY_BOARD_URL) {
        return officialWorkdayBoardPage
      }

      throw new Error(`Unexpected Evolent Health page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, evolent.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))

      if (requestedJsonBodies.length === 1) return unfilteredJobsPayload
      if (requestedJsonBodies.length === 2) return filteredIndiaJobsPayload

      throw new Error(`Unexpected Evolent Health jobs API call #${requestedJsonBodies.length}`)
    },
  })

  assert.deepEqual(requestedPages, [
    evolent.CAREERS_URL,
    evolent.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(requestedJsonBodies, [
    JSON.parse(evolent.buildUnfilteredJobsRequestBody({ offset: 0 })),
    JSON.parse(
      evolent.buildIndiaJobsRequestBody({
        offset: 0,
        locationFacetIds: ['0d12f7baa1f9019decd79d9d7a8d9703'],
      }),
    ),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'evolenthealth')
  assert.equal(jobs[0].company, 'Evolent Health')
  assert.equal(
    jobs[0].link,
    'https://evolent.wd1.myworkdayjobs.com/External/job/Pune/Sr-SaaS-Administrator--Enterprise-Applications_JR-916402/apply',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Evolent Health fails closed when the careers surface, Workday board, or verified India location facet changes materially', async () => {
  const evolent = await loadModule()

  await assert.rejects(
    evolent.createEvolentHealthScraper().run({
      fetchPage: async (url) => {
        if (url === evolent.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="https://example.com/jobs">Open roles</a></body></html>',
          }
        }

        throw new Error(`Unexpected Evolent Health page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaJobsPayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    evolent.createEvolentHealthScraper().run({
      fetchPage: async (url) => {
        if (url === evolent.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === evolent.WORKDAY_BOARD_URL) {
          return {
            ...officialWorkdayBoardPage,
            html: officialWorkdayBoardPage.html.replace('tenant: "evolent"', 'tenant: "example"'),
          }
        }

        throw new Error(`Unexpected Evolent Health page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaJobsPayload,
    }),
    /verified public workday board/i,
  )

  await assert.rejects(
    evolent.createEvolentHealthScraper().run({
      fetchPage: async (url) => {
        if (url === evolent.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === evolent.WORKDAY_BOARD_URL) {
          return officialWorkdayBoardPage
        }

        throw new Error(`Unexpected Evolent Health page URL: ${url}`)
      },
      fetchJson: async () => ({
        total: 42,
        jobPostings: [],
        facets: [{ facetParameter: 'jobFamilyGroup', values: [] }],
      }),
    }),
    /verified india workday facet changed/i,
  )
})


for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('evolenthealth recognizes upstream Workday board failures for HTTP ' + status, async () => {
    const mod = await import('../../scraper/evolenthealth.workday/script.js')
    const {classifyScraperError} = await import('../utils/failureClassification.js')
    await assert.rejects(mod.createEvolentHealthScraper().run({
      fetchPage: async url => {
        if (url === mod.WORKDAY_BOARD_URL) return {status,url,html}
        if (url === mod.CAREERS_URL) return {status:200,url,html:officialCareersHtml}
        throw new Error('Unexpected page: ' + url)
      },
      fetchJson: async () => assert.fail('Unavailable board must not request job listings'),
    }), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}
