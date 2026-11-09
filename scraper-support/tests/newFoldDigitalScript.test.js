import assert from 'node:assert/strict'
import test from 'node:test'

const loadNewFoldDigitalModule = async () => {
  try {
    return await import('../../scraper/newfolddigital.workday/script.js')
  } catch {
    assert.fail('Expected NewFold Digital scraper module at ../../scraper/newfolddigital.workday/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | NewFold Digital</title>
  </head>
  <body>
    <main>
      <h1>Be a part of the fold.</h1>
      <p>Build products and brands that help people succeed online.</p>
      <a href="https://web.wd1.myworkdayjobs.com/ExternalCareerSite">Browse Openings</a>
    </main>
  </body>
</html>
`

const officialWorkdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <link rel="canonical" href="https://web.wd1.myworkdayjobs.com/ExternalCareerSite" />
    <meta property="og:title" content="Open Jobs" />
    <meta property="og:description" content="NewFold Digital careers and open jobs." />
  </head>
  <body>
    <div id="mainContent">Open Jobs</div>
  </body>
</html>
`

const unfilteredJobsPayload = {
  total: 74,
  jobPostings: [
    {
      title: 'Chief Growth Officer (CGO)',
      externalPath: '/job/United-States---Remote/Chief-Growth-Officer--CGO-_R14776',
      locationsText: 'United States - Remote',
      postedOn: 'Posted Today',
      bulletFields: ['R14776'],
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
              descriptor: 'India - Remote',
              id: '6959821fe067011cdbc143052c016ed8',
              count: 3,
            },
            {
              descriptor: 'Mumbai, India',
              id: '6959821fe067015f7f4354052c01a5d8',
              count: 9,
            },
            {
              descriptor: 'Cebu, Philippines',
              id: '6959821fe0670154d6434e052c0191d8',
              count: 16,
            },
          ],
        },
      ],
    },
  ],
  userAuthenticated: false,
}

const filteredIndiaJobsPayload = {
  total: 2,
  jobPostings: [
    {
      title: 'Software Engineer',
      externalPath: '/job/India---Remote/Software-Engineer_R14614',
      locationsText: 'India - Remote',
      postedOn: 'Posted 3 Days Ago',
      bulletFields: ['R14614'],
    },
    {
      title: 'Compliance Associate',
      externalPath: '/job/Mumbai-India/Compliance-Associate_R14720',
      locationsText: 'Mumbai, India',
      postedOn: 'Posted 14 Days Ago',
      bulletFields: ['R14720'],
    },
  ],
}

test('NewFold Digital helper exports stay pinned to the verified careers handoff, public Workday board, and India location facets', async () => {
  const newFoldDigital = await loadNewFoldDigitalModule()

  assert.equal(newFoldDigital.SOURCE, 'newfolddigital')
  assert.equal(newFoldDigital.COMPANY, 'NewFold Digital')
  assert.equal(newFoldDigital.VERIFIED_ON, '2026-07-16')
  assert.equal(newFoldDigital.CAREERS_URL, 'https://www.newfold.com/careers')
  assert.equal(
    newFoldDigital.WORKDAY_BOARD_URL,
    'https://web.wd1.myworkdayjobs.com/ExternalCareerSite',
  )
  assert.equal(
    newFoldDigital.JOBS_API_URL,
    'https://web.wd1.myworkdayjobs.com/wday/cxs/web/ExternalCareerSite/jobs',
  )
  assert.deepEqual(newFoldDigital.VERIFIED_INDIA_LOCATION_NAMES, [
    'India - Remote',
    'Mumbai, India',
  ])
  assert.equal(newFoldDigital.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    newFoldDigital.extractVerifiedWorkdayBoardUrl(officialCareersHtml),
    'https://web.wd1.myworkdayjobs.com/ExternalCareerSite',
  )
  assert.equal(newFoldDigital.hasOfficialWorkdayBoardSignal(officialWorkdayBoardHtml), true)
  assert.deepEqual(
    newFoldDigital.extractIndiaLocationFacetIds(unfilteredJobsPayload),
    [
      '6959821fe067011cdbc143052c016ed8',
      '6959821fe067015f7f4354052c01a5d8',
    ],
  )
  assert.deepEqual(
    JSON.parse(newFoldDigital.buildUnfilteredJobsRequestBody({ offset: 0 })),
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  )
  assert.deepEqual(
    JSON.parse(
      newFoldDigital.buildIndiaJobsRequestBody({
        offset: 20,
        locationFacetIds: [
          '6959821fe067011cdbc143052c016ed8',
          '6959821fe067015f7f4354052c01a5d8',
        ],
      }),
    ),
    {
      appliedFacets: {
        locations: [
          '6959821fe067011cdbc143052c016ed8',
          '6959821fe067015f7f4354052c01a5d8',
        ],
      },
      limit: 20,
      offset: 20,
      searchText: '',
    },
  )
})

test('NewFold Digital run validates the verified public Workday board and extracts current India jobs conservatively', async () => {
  const newFoldDigital = await loadNewFoldDigitalModule()
  const requestedPages = []
  const requestedJsonBodies = []

  const jobs = await newFoldDigital.createNewFoldDigitalScraper({
    now: () => '2026-07-16T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === newFoldDigital.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      throw new Error(`Unexpected NewFold Digital page URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      assert.equal(url, newFoldDigital.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))

      if (requestedJsonBodies.length === 1) return unfilteredJobsPayload
      if (requestedJsonBodies.length === 2) return filteredIndiaJobsPayload

      throw new Error(`Unexpected NewFold Digital jobs API call #${requestedJsonBodies.length}`)
    },
  })

  assert.deepEqual(requestedPages, [newFoldDigital.WORKDAY_BOARD_URL])
  assert.deepEqual(requestedJsonBodies, [
    JSON.parse(newFoldDigital.buildUnfilteredJobsRequestBody({ offset: 0 })),
    JSON.parse(
      newFoldDigital.buildIndiaJobsRequestBody({
        offset: 0,
        locationFacetIds: [
          '6959821fe067011cdbc143052c016ed8',
          '6959821fe067015f7f4354052c01a5d8',
        ],
      }),
    ),
  ])

  assert.deepEqual(jobs, [
    {
      jobId: 'R14720',
      title: 'Compliance Associate',
      company: 'NewFold Digital',
      department: null,
      location: 'Mumbai, India',
      city: 'Mumbai',
      locations: ['Mumbai, India'],
      link: 'https://web.wd1.myworkdayjobs.com/ExternalCareerSite/job/Mumbai-India/Compliance-Associate_R14720',
      source: 'newfolddigital',
      postedAt: 'Posted 14 Days Ago',
      closingDate: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      requisitionId: 'R14720',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
    {
      jobId: 'R14614',
      title: 'Software Engineer',
      company: 'NewFold Digital',
      department: null,
      location: 'Remote, India',
      city: 'Remote',
      locations: ['India - Remote'],
      link: 'https://web.wd1.myworkdayjobs.com/ExternalCareerSite/job/India---Remote/Software-Engineer_R14614',
      source: 'newfolddigital',
      postedAt: 'Posted 3 Days Ago',
      closingDate: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      requisitionId: 'R14614',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('NewFold Digital returns [] when the verified public Workday surface has no current India location facets', async () => {
  const newFoldDigital = await loadNewFoldDigitalModule()

  const jobs = await newFoldDigital.createNewFoldDigitalScraper().run({
    fetchPage: async (url) => {
      if (url === newFoldDigital.WORKDAY_BOARD_URL) {
        return {
          status: 200,
          url,
          html: officialWorkdayBoardHtml,
        }
      }

      throw new Error(`Unexpected NewFold Digital page URL: ${url}`)
    },
    fetchJson: async () => ({
      total: 2,
      jobPostings: [],
      facets: [
        {
          facetParameter: 'locationMainGroup',
          values: [
            {
              facetParameter: 'locations',
              descriptor: 'Locations',
              values: [
                {
                  descriptor: 'Cebu, Philippines',
                  id: '6959821fe0670154d6434e052c0191d8',
                  count: 16,
                },
              ],
            },
          ],
        },
      ],
    }),
  })

  assert.deepEqual(jobs, [])
})

test('NewFold Digital fails closed when the verified public Workday board or India facet contract drifts', async () => {
  const newFoldDigital = await loadNewFoldDigitalModule()

  await assert.rejects(
    newFoldDigital.createNewFoldDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === newFoldDigital.WORKDAY_BOARD_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Jobs</h1></body></html>',
          }
        }

        throw new Error(`Unexpected NewFold Digital page URL: ${url}`)
      },
      fetchJson: async () => filteredIndiaJobsPayload,
    }),
    /verified public workday board/i,
  )

  await assert.rejects(
    newFoldDigital.createNewFoldDigitalScraper().run({
      fetchPage: async (url) => {
        if (url === newFoldDigital.WORKDAY_BOARD_URL) {
          return {
            status: 200,
            url,
            html: officialWorkdayBoardHtml,
          }
        }

        throw new Error(`Unexpected NewFold Digital page URL: ${url}`)
      },
      fetchJson: async () => ({
        total: 74,
        jobPostings: [],
        facets: [{ facetParameter: 'jobFamilyGroup', values: [] }],
      }),
    }),
    /verified india workday facet/i,
  )
})
