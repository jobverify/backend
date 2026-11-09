import assert from 'node:assert/strict'
import test from 'node:test'

const loadIdfyModule = async () => {
  try {
    return await import('../../scraper/idfy/script.js')
  } catch {
    assert.fail('Expected IDfy scraper module at ../../scraper/idfy/script.js')
  }
}

const boardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>IDfy</title>
      <meta property="og:title" content="IDfy - Career Page">
      <meta property="og:site_name" content="IDfy">
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
    </body>
  </html>
`

const careersWrapperHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>IDfy Careers</title>
    </head>
    <body>
      <main>
        <p>Life at IDfy : Unscripted.</p>
        <p>Expect the Unexpected</p>
        <p>Helping a billion people move through life with trust.</p>
        <a href="https://idfy.turbohire.co/careerpage/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572">Open roles →</a>
      </main>
    </body>
  </html>
`

const sampleTurboHirePayload = {
  Total: 2,
  Result: [
    {
      JobId: 'idfy-role-1',
      JobIdObfuscated: 'public-role-1',
      JobCode: 'I-67457',
      JobTitle: 'Module Lead - DevOps',
      Department: 'Tech',
      PublishedDate: '2026-07-14T06:23:55.2698535Z',
      ExpiryDates: {
        CAREERPAGE: '2026-08-14T00:00:00',
      },
      Location: '[{"Address":"Mumbai, Maharashtra, India"}]',
      JobTypeV2: 'Replacements',
      Experience: {
        MinExp: 6,
        MaxExp: 8,
      },
      Skills: [
        'AWS',
        'DevOps',
      ],
      JobDescV2: '<p>Lead platform reliability and cloud automation.</p>',
      OrgDetails: {
        OrgID: 'e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
        OrgName: 'IDfy',
      },
    },
    {
      JobId: 'idfy-role-2',
      JobIdObfuscated: 'ignored-role-2',
      JobCode: 'I-70000',
      JobTitle: 'Global Partnerships Lead',
      Department: 'Business',
      PublishedDate: '2026-07-10T06:23:55.2698535Z',
      ExpiryDates: {
        CAREERPAGE: '2026-08-10T00:00:00',
      },
      Location: '[{"Address":"Dubai, United Arab Emirates"}]',
      JobTypeV2: 'Replacements',
      Experience: {
        MinExp: 6,
        MaxExp: 8,
      },
      Skills: [
        'Alliances',
      ],
      JobDescV2: '<p>Ignore non-India roles.</p>',
      OrgDetails: {
        OrgID: 'e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
        OrgName: 'IDfy',
      },
    },
  ],
}

const FULL_DESCRIPTION = 'Responsibilities: Lead platform reliability and cloud automation for production services. Required qualifications: Build and operate reliable deployment pipelines, monitor production systems and maintain secure infrastructure.'
const sampleDetail = () => ({ ...structuredClone(sampleTurboHirePayload.Result[0]),
  JobDescriptionV2: `<p>${FULL_DESCRIPTION}</p>`, PublishedDates: { CAREERPAGE: sampleTurboHirePayload.Result[0].PublishedDate },
  IsPublic: true, JobStatus: 'Active', PublishedJobBoards: ['CAREERPAGE'] })

test('IDfy helpers stay pinned to the verified official TurboHire handoff and public feed', async () => {
  const idfy = await loadIdfyModule()

  assert.equal(idfy.SOURCE, 'idfy')
  assert.equal(idfy.COMPANY, 'IDfy')
  assert.equal(idfy.OFFICIAL_CAREERS_URL, 'https://www.idfy.com/careers/')
  assert.equal(idfy.ORIGIN, 'https://idfy.turbohire.co')
  assert.equal(idfy.ORG_ID, 'e73676a8-bc5a-4b43-b9c6-d3fc7a60b572')
  assert.equal(
    idfy.BOARD_URL,
    'https://idfy.turbohire.co/careerpage/e73676a8-bc5a-4b43-b9c6-d3fc7a60b572',
  )
  assert.equal(idfy.API_BASE_URL, 'https://thapi.azurewebsites.net')
  assert.equal(idfy.NOAUTH_TOKEN_URL, 'https://thapi.azurewebsites.net/api/token/noauth')
  assert.equal(
    idfy.FILTERED_JOBS_URL,
    'https://thapi.azurewebsites.net/api/careerpagev2/filteredjobs?orgId=e73676a8-bc5a-4b43-b9c6-d3fc7a60b572&pageType=0',
  )
  assert.equal(idfy.isVerifiedBoardUrl(idfy.BOARD_URL), true)
  assert.equal(idfy.hasOfficialBoardSignal(boardHtml), true)
  assert.equal(idfy.extractOfficialBoardUrl(careersWrapperHtml), idfy.BOARD_URL)
  assert.equal(idfy.hasOfficialCareersWrapperSignal(careersWrapperHtml), true)
  assert.deepEqual(JSON.parse(idfy.buildFilteredJobsRequestBody()), {
    SortByV2: { Key: 'PostedDate', Order: 2 },
    BunitIds: { Value: null, FilterType: 0 },
    Experience: { Value: null, FilterType: 0 },
    JobTypes: { Value: null, FilterType: 0 },
    JobTypeV2: { Value: null, FilterType: 0 },
    Locations: { Value: null, FilterType: 0 },
    CreatedDate: { Value: null, FilterType: 0 },
    Compensation: { Value: null, FilterType: 0 },
    Skills: { Value: null, FilterType: 0 },
    Keyword: '',
    ClientIds: { Value: null, FilterType: 0 },
    Department: '',
    CustomFields: {},
  })
})

test('extractPublicJobs normalizes India jobs from the verified IDfy TurboHire feed', async () => {
  const idfy = await loadIdfyModule()

  assert.deepEqual(idfy.extractPublicJobs(sampleTurboHirePayload), [
    {
      title: 'Module Lead - DevOps',
      company: 'IDfy',
      department: 'Tech',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'idfy-role-1',
      requisitionId: 'I-67457',
      sourceUrl: 'https://idfy.turbohire.co/job/publicjobs/public-role-1',
      applyUrl: 'https://idfy.turbohire.co/job/publicjobs/public-role-1',
      employmentType: 'Replacements',
      experienceRequired: '6-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'AWS',
        'DevOps',
      ],
      postingDate: '2026-07-14T06:23:55.2698535Z',
      closingDate: '2026-08-14T00:00:00',
      jobDescription: 'Lead platform reliability and cloud automation.',
    },
  ])
})

test('run validates the official IDfy handoff before reading the public TurboHire feed', async () => {
  const idfy = await loadIdfyModule()
  const requested = []

  const jobs = await idfy.createIdfyScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })
      if (url === idfy.OFFICIAL_CAREERS_URL) {
        return {
          status: 200,
          url: idfy.BOARD_URL,
          html: boardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, method: options.method || 'GET' })
      if (url === idfy.NOAUTH_TOKEN_URL) return { access_token: 'public-token' }
      if (url === idfy.FILTERED_JOBS_URL) return sampleTurboHirePayload
      if (url === `${idfy.API_BASE_URL}/api/publicjobs/idfy-role-1?fieldVisibility=CareerPage`) return sampleDetail()
      throw new Error(`Unexpected json URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'page', url: idfy.OFFICIAL_CAREERS_URL },
    { type: 'json', url: idfy.NOAUTH_TOKEN_URL, method: 'GET' },
    { type: 'json', url: idfy.FILTERED_JOBS_URL, method: 'POST' },
    { type: 'json', url: `${idfy.API_BASE_URL}/api/publicjobs/idfy-role-1?fieldVisibility=CareerPage`, method: 'GET' },
    { type: 'json', url: idfy.FILTERED_JOBS_URL, method: 'POST' },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'idfy')
  assert.equal(jobs[0].company, 'IDfy')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('run accepts the current branded careers wrapper when it still hands off to the verified TurboHire board', async () => {
  const idfy = await loadIdfyModule()
  const requested = []

  const jobs = await idfy.createIdfyScraper({ maxJobs: 1 }).run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })

      if (url === idfy.OFFICIAL_CAREERS_URL) {
        return {
          status: 200,
          url: idfy.OFFICIAL_CAREERS_URL,
          html: careersWrapperHtml,
        }
      }

      if (url === idfy.BOARD_URL) {
        return {
          status: 200,
          url: idfy.BOARD_URL,
          html: boardHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, method: options.method || 'GET' })
      if (url === idfy.NOAUTH_TOKEN_URL) return { access_token: 'public-token' }
      if (url === idfy.FILTERED_JOBS_URL) return sampleTurboHirePayload
      if (url === `${idfy.API_BASE_URL}/api/publicjobs/idfy-role-1?fieldVisibility=CareerPage`) return sampleDetail()
      throw new Error(`Unexpected json URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'page', url: idfy.OFFICIAL_CAREERS_URL },
    { type: 'page', url: idfy.BOARD_URL },
    { type: 'json', url: idfy.NOAUTH_TOKEN_URL, method: 'GET' },
    { type: 'json', url: idfy.FILTERED_JOBS_URL, method: 'POST' },
    { type: 'json', url: `${idfy.API_BASE_URL}/api/publicjobs/idfy-role-1?fieldVisibility=CareerPage`, method: 'GET' },
    { type: 'json', url: idfy.FILTERED_JOBS_URL, method: 'POST' },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'idfy')
})

test('run fails closed when the verified IDfy handoff changes', async () => {
  const idfy = await loadIdfyModule()

  await assert.rejects(
    idfy.createIdfyScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://example.com/jobs',
        html: '<html><body><h1>Join us</h1></body></html>',
      }),
      fetchJson: async () => sampleTurboHirePayload,
    }),
    /official careers handoff changed/i,
  )
})
