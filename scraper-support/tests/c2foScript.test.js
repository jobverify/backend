import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T19:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>Careers - C2FO</title>
      <link rel="canonical" href="https://c2fo.com/careers/">
    </head>
    <body>
      <h1>Make Your Career Make a Difference</h1>
      <p>
        Do work that matters with a team that cares. C2FO is proud to be one of the fastest-growing,
        most dynamic financial technology companies, with career opportunities available around the globe.
      </p>
      <a href="https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL">Browse Open Positions</a>
    </body>
  </html>
`

const siteContextPayload = {
  clientNamespace: 'c2fo',
  jobBoardCode: 'candidateportal',
  jobBoardId: 1,
}

const searchPayload = {
  maxCount: 2,
  postings: [
    {
      jobPostingId: 2213,
      jobReqId: 299,
      jobTitle: 'Applied AI Scientist, GenAI and ML Prototyping',
      postingStartTimestampUTC: '2026-07-01T00:00:00Z',
      postingExpiryTimestampUTC: '2026-08-01T00:00:00Z',
      hasVirtualLocation: true,
      postingLocations: [
        {
          cityName: 'Noida',
          stateCode: 'UP',
          isoCountryCode: 'IN',
          formattedAddress: 'Noida, Uttar Pradesh, India',
        },
      ],
    },
    {
      jobPostingId: 2293,
      jobReqId: 412,
      jobTitle: 'Supplier Sales',
      postingStartTimestampUTC: '2026-07-02T00:00:00Z',
      postingExpiryTimestampUTC: '2026-08-02T00:00:00Z',
      postingLocations: [
        {
          cityName: 'Kansas City',
          stateCode: 'MO',
          isoCountryCode: 'US',
          formattedAddress: 'Kansas City, Missouri, United States',
        },
      ],
    },
  ],
}

const detailPayload = {
  jobPostingInfo: {
    jobPostingId: 2213,
    jobReqId: 299,
    jobTitle: 'Applied AI Scientist, GenAI and ML Prototyping',
    postingStartTimestampUTC: '2026-07-01T00:00:00Z',
    postingExpiryTimestampUTC: '2026-08-01T00:00:00Z',
    postingLocations: [
      {
        cityName: 'Noida',
        stateCode: 'UP',
        isoCountryCode: 'IN',
        formattedAddress: 'Noida, Uttar Pradesh, India',
      },
    ],
    jobDescriptionHeader: '<p><strong>Experience</strong>: 4-6 years</p><p><strong>Location:</strong> REMOTE</p>',
    jobDescription: '<p>Prototype GenAI and ML solutions for global working capital products.</p>',
    jobDescriptionFooter: '<p>C2FO is an Equal Opportunity Employer.</p>',
    jobPostingAttributes: [
      { name: 'JobFamily', value: 'Product and Tech' },
      { name: 'JobFunction', value: 'Data' },
      { name: 'PayType', value: 'Salary' },
    ],
  },
}

const loadC2foModule = async () => {
  try {
    return await import('../../scraper/c2fo/script.js')
  } catch {
    assert.fail('Expected C2FO scraper module at ../../scraper/c2fo/script.js')
  }
}

test('pins C2FO to the verified official Dayforce handoff and Dayforce job search contract', async () => {
  const c2fo = await loadC2foModule()

  assert.equal(c2fo.COMPANY_NAME, 'C2FO')
  assert.equal(c2fo.SOURCE, 'c2fo')
  assert.equal(c2fo.OFFICIAL_CAREERS_URL, 'https://c2fo.com/careers/')
  assert.equal(c2fo.OFFICIAL_DAYFORCE_URL, 'https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL')
  assert.equal(c2fo.DAYFORCE_CLIENT_NAMESPACE, 'c2fo')
  assert.equal(c2fo.DAYFORCE_JOB_BOARD_CODE, 'CANDIDATEPORTAL')
  assert.equal(c2fo.DAYFORCE_JOB_BOARD_ID, 1)
  assert.equal(c2fo.DAYFORCE_LOCALE, 'en-US')
  assert.equal(c2fo.extractOfficialDayforceUrl(officialCareersHtml), c2fo.OFFICIAL_DAYFORCE_URL)
  assert.equal(c2fo.hasOfficialC2foCareersSignals(officialCareersHtml), true)
  assert.equal(
    c2fo.hasOfficialC2foCareersSignals(
      officialCareersHtml.replace(c2fo.OFFICIAL_DAYFORCE_URL, 'https://example.com/jobs'),
    ),
    false,
  )
  assert.equal(c2fo.hasVerifiedDayforceSiteContext(siteContextPayload), true)
  assert.deepEqual(c2fo.buildSearchRequestPayload(), {
    clientNamespace: 'c2fo',
    jobBoardCode: 'CANDIDATEPORTAL',
    cultureCode: 'en-US',
    distanceUnit: 0,
    paginationStart: 0,
  })
})

test('run verifies the official C2FO Dayforce surface and returns only India jobs with detail enrichment', async () => {
  const { buildSearchRequestPayload, createC2foScraper } = await loadC2foModule()
  const requestedPayloads = []
  const requestedJobIds = []

  const jobs = await createC2foScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async () => siteContextPayload,
    searchJobPostings: async (payload) => {
      requestedPayloads.push(payload)
      return searchPayload
    },
    fetchJobDetail: async (jobPostingId) => {
      requestedJobIds.push(jobPostingId)
      return detailPayload
    },
  })

  assert.deepEqual(requestedPayloads, [buildSearchRequestPayload()])
  assert.deepEqual(requestedJobIds, ['2213'])
  assert.deepEqual(jobs, [
    {
      title: 'Applied AI Scientist, GenAI and ML Prototyping',
      company: 'C2FO',
      department: 'Product and Tech',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      jobId: '2213',
      requisitionId: '299',
      sourceUrl: 'https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL/jobs/2213',
      applyUrl: 'https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL/jobs/2213',
      employmentType: null,
      experienceRequired: '4-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01T00:00:00Z',
      closingDate: '2026-08-01T00:00:00Z',
      jobDescription: '<p><strong>Experience</strong>: 4-6 years</p><p><strong>Location:</strong> REMOTE</p>\n<p>Prototype GenAI and ML solutions for global working capital products.</p>\n<p>C2FO is an Equal Opportunity Employer.</p>',
      source: 'c2fo',
      link: 'https://jobs.dayforcehcm.com/en-US/c2fo/CANDIDATEPORTAL/jobs/2213',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run uses the default session-free Dayforce search and detail contract when overrides are absent', async () => {
  const c2fo = await loadC2foModule()
  const requested = []

  const jobs = await c2fo.createC2foScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => officialCareersHtml,
    createDayforceSessionImpl: async () => ({
      csrfToken: 'csrf-token',
      cookieHeader: 'cookie-a=1; cookie-b=2',
    }),
    fetchJson: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null,
      })

      if (url === c2fo.buildSiteContextUrl()) return siteContextPayload
      if (url === c2fo.buildSearchApiUrl()) return searchPayload
      if (url === c2fo.buildJobDetailApiUrl('2213')) return detailPayload

      throw new Error(`Unexpected C2FO URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    requested.map((entry) => ({
      url: entry.url,
      method: entry.method,
      hasCookie: entry.headers.Cookie || null,
      hasCsrf: entry.headers['X-CSRF-Token'] || null,
      body: entry.body,
    })),
    [
      {
        url: c2fo.buildSiteContextUrl(),
        method: 'GET',
        hasCookie: null,
        hasCsrf: null,
        body: null,
      },
      {
        url: c2fo.buildSearchApiUrl(),
        method: 'POST',
        hasCookie: 'cookie-a=1; cookie-b=2',
        hasCsrf: 'csrf-token',
        body: JSON.stringify(c2fo.buildSearchRequestPayload()),
      },
      {
        url: c2fo.buildJobDetailApiUrl('2213'),
        method: 'GET',
        hasCookie: 'cookie-a=1; cookie-b=2',
        hasCsrf: 'csrf-token',
        body: null,
      },
    ],
  )
})

test('fails closed when the verified official careers handoff or Dayforce site context drifts', async () => {
  const { createC2foScraper } = await loadC2foModule()
  const scraper = createC2foScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace(
        'Browse Open Positions',
        'Learn more about C2FO',
      ),
      fetchJson: async () => siteContextPayload,
      searchJobPostings: async () => searchPayload,
    }),
    /verified official careers page no longer matches the verified Dayforce public surface/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        clientNamespace: 'c2fo',
        jobBoardCode: 'some-other-board',
        jobBoardId: 1,
      }),
      searchJobPostings: async () => searchPayload,
    }),
    /verified Dayforce public jobs surface no longer matches the pinned C2FO site context/i,
  )
})
