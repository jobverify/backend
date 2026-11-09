import assert from 'node:assert/strict'
import test from 'node:test'

const loadAptosIndiaModule = async () => {
  try {
    return await import('../../scraper/aptosindia.workday/script.js')
  } catch {
    assert.fail('Expected Aptos India scraper module at ../../scraper/aptosindia.workday/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Aptos</title>
    <meta
      name="description"
      content="Our technologies, clients, compensation and culture combine to help us consistently appeal to the brightest minds in retail technology."
    />
  </head>
  <body>
    <main>
      <h1><b>Aptos Careers</b></h1>
      <h2>Careers Quick Links</h2>
      <a href="https://aptos.wd108.myworkdayjobs.com/Aptos" class="card">Search Open Jobs</a>
    </main>
  </body>
</html>
`

const officialWorkdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://aptos.wd108.myworkdayjobs.com/Aptos" />
    <meta name="title" property="og:title" content="Open Jobs">
    <meta
      name="description"
      property="og:description"
      content="Aptos is the global leader in unified commerce solutions for retailers. Hundreds of leading retail brands around the world trust our modern, cloud-native POS and advanced enterprise solutions."
    >
  </head>
  <body>
    <div id="mainContent">Open Jobs</div>
  </body>
</html>
`

const unfilteredJobsPayload = {
  total: 9,
  jobPostings: [
    {
      title: 'Professional Services Consultant Aptos ONE',
      externalPath: '/job/UK-Birmingham-Office/Professional-Services-Consultant-Aptos-ONE_JR100066',
      locationsText: 'UK Birmingham Office',
      postedOn: 'Posted 13 Days Ago',
      bulletFields: ['Remote', 'JR100066'],
    },
  ],
  facets: [
    {
      facetParameter: 'jobFamilyGroup',
      values: [],
    },
    {
      facetParameter: 'locationMainGroup',
      values: [
        {
          facetParameter: 'locations',
          descriptor: 'Locations',
          values: [
            {
              descriptor: 'IN Bangalore Office',
              id: '017ec52924b01000f9da0bd192330000',
              count: 3,
            },
            {
              descriptor: 'CA Montreal Office',
              id: '017ec52924b01000f9da56e4dc120000',
              count: 2,
            },
          ],
        },
      ],
    },
  ],
  userAuthenticated: false,
}

const filteredIndiaJobsPayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Principal Engineer - OMS',
      externalPath: '/job/IN-Bangalore-Office/Sr-Software-Developer-L4--Assoc-Princ-_JR100060-1',
      locationsText: 'IN Bangalore Office',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['JR100060'],
    },
    {
      title: 'Mgr. Software Development',
      externalPath: '/job/IN-Bangalore-Office/Mgr-Software-Development_JR100070',
      locationsText: 'IN Bangalore Office',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['JR100070'],
    },
    {
      title: 'Senior Technical Consultant',
      externalPath: '/job/IN-Bangalore-Office/Senior-Technical-Consultant_JR100050-1',
      locationsText: 'IN Bangalore Office',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['JR100050'],
    },
  ],
}

test('Aptos India pins the verified first-party Aptos careers page, public Workday board, and India facet contract', async () => {
  const aptosIndia = await loadAptosIndiaModule()

  assert.equal(aptosIndia.SOURCE, 'aptosindia')
  assert.equal(aptosIndia.COMPANY, 'Aptos India')
  assert.equal(aptosIndia.CAREERS_URL, 'https://www.aptos.com/careers')
  assert.equal(aptosIndia.WORKDAY_BOARD_URL, 'https://aptos.wd108.myworkdayjobs.com/Aptos')
  assert.equal(
    aptosIndia.JOBS_API_URL,
    'https://aptos.wd108.myworkdayjobs.com/wday/cxs/aptos/Aptos/jobs',
  )
  assert.equal(aptosIndia.VERIFIED_INDIA_LOCATION_NAME, 'IN Bangalore Office')
  assert.equal(aptosIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    aptosIndia.extractVerifiedWorkdayBoardUrl(officialCareersHtml),
    'https://aptos.wd108.myworkdayjobs.com/Aptos',
  )
  assert.equal(aptosIndia.hasOfficialWorkdayBoardSignal(officialWorkdayBoardHtml), true)
  assert.deepEqual(
    aptosIndia.extractIndiaLocationFacetIds(unfilteredJobsPayload),
    ['017ec52924b01000f9da0bd192330000'],
  )
  assert.deepEqual(
    JSON.parse(aptosIndia.buildUnfilteredJobsRequestBody({ offset: 0 })),
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )
  assert.deepEqual(
    JSON.parse(
      aptosIndia.buildIndiaJobsRequestBody({
        offset: 20,
        locationFacetIds: ['017ec52924b01000f9da0bd192330000'],
      }),
    ),
    {
      appliedFacets: {
        locations: ['017ec52924b01000f9da0bd192330000'],
      },
      limit: 20,
      offset: 20,
      searchText: '',
    },
  )
})

test('Aptos India run validates the verified first-party handoff and extracts live-shape India Workday jobs', async () => {
  const aptosIndia = await loadAptosIndiaModule()
  const requestedPages = []
  const requestedJsonBodies = []

  const jobs = await aptosIndia.createAptosIndiaScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === aptosIndia.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: officialCareersHtml,
        }
      }

      if (url === aptosIndia.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      throw new Error(`Unexpected Aptos India page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, aptosIndia.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))

      if (requestedJsonBodies.length === 1) {
        return unfilteredJobsPayload
      }

      if (requestedJsonBodies.length === 2) {
        return filteredIndiaJobsPayload
      }

      throw new Error(`Unexpected Aptos India jobs API call #${requestedJsonBodies.length}`)
    },
  })

  assert.deepEqual(requestedPages, [
    aptosIndia.CAREERS_URL,
    aptosIndia.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(requestedJsonBodies, [
    JSON.parse(aptosIndia.buildUnfilteredJobsRequestBody({ offset: 0 })),
    JSON.parse(
      aptosIndia.buildIndiaJobsRequestBody({
        offset: 0,
        locationFacetIds: ['017ec52924b01000f9da0bd192330000'],
      }),
    ),
  ])

  assert.deepEqual(jobs, [
    {
      jobId: 'JR100070',
      title: 'Mgr. Software Development',
      company: 'Aptos India',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      locations: ['IN Bangalore Office'],
      link: 'https://aptos.wd108.myworkdayjobs.com/Aptos/job/IN-Bangalore-Office/Mgr-Software-Development_JR100070',
      source: 'aptosindia',
      postedAt: null,
      closingDate: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      requisitionId: 'JR100070',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      jobId: 'JR100060',
      title: 'Principal Engineer - OMS',
      company: 'Aptos India',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      locations: ['IN Bangalore Office'],
      link: 'https://aptos.wd108.myworkdayjobs.com/Aptos/job/IN-Bangalore-Office/Sr-Software-Developer-L4--Assoc-Princ-_JR100060-1',
      source: 'aptosindia',
      postedAt: null,
      closingDate: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      requisitionId: 'JR100060',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
    {
      jobId: 'JR100050',
      title: 'Senior Technical Consultant',
      company: 'Aptos India',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      locations: ['IN Bangalore Office'],
      link: 'https://aptos.wd108.myworkdayjobs.com/Aptos/job/IN-Bangalore-Office/Senior-Technical-Consultant_JR100050-1',
      source: 'aptosindia',
      postedAt: null,
      closingDate: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      requisitionId: 'JR100050',
      scrapedAt: '2026-07-15T00:00:00.000Z',
    },
  ])
})

test('Aptos India fails closed when the verified careers handoff or India Workday facet changes materially', async () => {
  const aptosIndia = await loadAptosIndiaModule()

  await assert.rejects(
    aptosIndia.createAptosIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === aptosIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Join Aptos</h1></body></html>',
          }
        }

        throw new Error(`Unexpected Aptos India page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaJobsPayload,
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    aptosIndia.createAptosIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === aptosIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(
              'https://aptos.wd108.myworkdayjobs.com/Aptos',
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Aptos India page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaJobsPayload,
    }),
    /verified workday handoff changed/i,
  )

  await assert.rejects(
    aptosIndia.createAptosIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === aptosIndia.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml,
          }
        }

        if (url === aptosIndia.WORKDAY_BOARD_URL) {
          return {
            status: 200,
            url,
            html: officialWorkdayBoardHtml,
          }
        }

        throw new Error(`Unexpected Aptos India page URL: ${url}`)
      },
      fetchJson: async () => ({
        total: 9,
        jobPostings: [],
        facets: [{ facetParameter: 'jobFamilyGroup', values: [] }],
      }),
    }),
    /verified india workday facet changed/i,
  )
})
