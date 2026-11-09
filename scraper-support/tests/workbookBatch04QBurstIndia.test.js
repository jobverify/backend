import assert from 'node:assert/strict'
import test from 'node:test'

const qburstIndiaModule = await import('../../scraper/qburstindia/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  OFFICIAL_BRAND,
  OPENINGS_URL,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  buildJobFromDetail,
  createQBurstIndiaScraper,
  extractJobCardSummary,
  extractSectionLines,
  hasVerifiedCareersLandingSignal,
  hasVerifiedLegacyOpeningsBoardSignal,
  hasVerifiedOpeningsEmptyStateSignal,
  hasVerifiedOpeningsPageSignal,
  normalizeQburstLocation,
  run,
} = qburstIndiaModule

const VERIFIED_CAREERS_LANDING_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | QBurst</title>
      <link rel="canonical" href="https://www.qburst.com/en-in/company/career/" />
    </head>
    <body>
      <main>
        <h1>Join a High AI-Q Company Powered by People</h1>
        <p>Search Open Roles</p>
        <p>Recruitment Fraud Alert</p>
      </main>
    </body>
  </html>
`

const VERIFIED_LEGACY_OPENINGS_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Job Openings | QBurst</title>
      <meta
        name="description"
        content="Match your experience with the current openings and apply where you think you fit best."
      />
      <link rel="canonical" href="https://www.qburst.com/en-in/company/career/openings/" />
    </head>
    <body>
      <main>
        <script>
          window.__QBURST_FILTERS__ = { block: 'job-list-filter-block', count_display_text: 'We Found {{count}} Job Openings for You' }
        </script>
        <p>Sort by Location</p>
        <p>Sort by Skills</p>
        <p>Sort by Department</p>
      </main>
    </body>
  </html>
`

const VERIFIED_EMPTY_OPENINGS_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Job Openings | QBurst</title>
      <link rel="canonical" href="https://www.qburst.com/en-in/company/career/openings/" />
    </head>
    <body>
      <main>
        <h1>Open Positions</h1>
        <p>We need people like you. Submit your resume for future opportunities.</p>
        <button>Submit Resume</button>
      </main>
    </body>
  </html>
`

test('QBurst India validates the verified empty openings surface and returns []', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return VERIFIED_CAREERS_LANDING_HTML
      if (url === OPENINGS_URL) return VERIFIED_EMPTY_OPENINGS_HTML
      assert.fail(`Unexpected fetchHtml URL: ${url}`)
    },
    scrapeJobs: async () => {
      assert.fail('scrapeJobs should not run while the openings page is in the verified empty state')
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, OPENINGS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'qburstindia')
  assert.equal(COMPANY, 'Qburst India')
  assert.equal(OFFICIAL_BRAND, 'QBurst')
  assert.equal(DISPOSITION, 'official-company-careers-empty-openings')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Tuesday, August 4, 2026/)
  assert.match(VERIFIED_SURFACE_SUMMARY, /future opportunities/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Submit Resume/i)
  assert.equal(typeof createQBurstIndiaScraper, 'function')
  assert.equal(hasVerifiedCareersLandingSignal(VERIFIED_CAREERS_LANDING_HTML), true)
  assert.equal(hasVerifiedLegacyOpeningsBoardSignal(VERIFIED_LEGACY_OPENINGS_HTML), true)
  assert.equal(hasVerifiedOpeningsEmptyStateSignal(VERIFIED_EMPTY_OPENINGS_HTML), true)
  assert.equal(hasVerifiedOpeningsPageSignal(VERIFIED_EMPTY_OPENINGS_HTML), true)
})

test('QBurst India still supports the historical job-board surface when public job cards return', async () => {
  const requestedUrls = []
  const expectedJobs = [
    {
      title: 'Associate Director/Director - AI-Native Engineering & Digital Experience',
      company: COMPANY,
      location: 'Multiple Cities, India',
      city: null,
      country: 'India',
      link: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      sourceUrl: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      applyUrl: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      jobId: 'DE-DEV/002',
      requisitionId: 'DE-DEV/002',
      department: null,
      employmentType: null,
      remoteStatus: null,
      experienceRequired: '15 - 20 yrs',
      minimumQualification: 'Build and scale AI-native practices.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Responsibilities: Build and scale AI-native practices. Requirements: Build and scale AI-native practices.',
      source: SOURCE,
      scrapedAt: '2026-08-01T00:00:00.000Z',
    },
  ]

  const jobs = await run({
    now: () => '2026-08-01T00:00:00.000Z',
    fetchHtml: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return VERIFIED_CAREERS_LANDING_HTML
      if (url === OPENINGS_URL) return VERIFIED_LEGACY_OPENINGS_HTML
      assert.fail(`Unexpected fetchHtml URL: ${url}`)
    },
    scrapeJobs: async ({ openingsUrl, maxJobs }) => {
      assert.equal(openingsUrl, OPENINGS_URL)
      assert.equal(maxJobs, Number.POSITIVE_INFINITY)
      return expectedJobs
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, OPENINGS_URL])
  assert.deepEqual(jobs, expectedJobs)
  assert.equal(SOURCE, 'qburstindia')
  assert.equal(COMPANY, 'Qburst India')
  assert.equal(OFFICIAL_BRAND, 'QBurst')
  assert.equal(DISPOSITION, 'official-company-careers-empty-openings')
  assert.equal(hasVerifiedOpeningsPageSignal(VERIFIED_LEGACY_OPENINGS_HTML), true)
})

test('QBurst India blocks its browser-only historical board path before a browser can launch', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => (
        url === CAREERS_URL ? VERIFIED_CAREERS_LANDING_HTML : VERIFIED_LEGACY_OPENINGS_HTML
      ),
    }),
    /qburstindia.*api-only migration.*browser automation is disabled/i,
  )
})

test('QBurst India parses the live job card summary structure', () => {
  assert.deepEqual(
    extractJobCardSummary([
      'DE-DEV/002',
      'Associate Director/Director - AI-Native Engineering & Digital Experience',
      'Multiple Cities, India',
      '15 - 20 yrs',
      'View and Apply',
    ]),
    {
      jobId: 'DE-DEV/002',
      title: 'Associate Director/Director - AI-Native Engineering & Digital Experience',
      location: 'Multiple Cities, India',
      experienceRequired: '15 - 20 yrs',
      previewText: null,
    },
  )
})

test('QBurst India extracts detail sections and normalizes multi-city India jobs', () => {
  const detailLines = [
    'Associate Director/Director - AI-Native Engineering & Digital Experience',
    'Multiple Cities, India',
    '15 - 20 yrs',
    'Locations',
    'India - Trivandrum,',
    'India - Cochin,',
    'India - Chennai,',
    'India - Bangalore',
    'Responsibilities',
    'Build and scale AI-native practices.',
    'Requirements',
    'Build and scale AI-native practices.',
    'Apply For Associate Director/Director - AI-Native Engineering & Digital Experience',
  ]

  assert.deepEqual(
    extractSectionLines(detailLines, 'Locations', ['Responsibilities', 'Requirements', 'Apply For']),
    ['India - Trivandrum,', 'India - Cochin,', 'India - Chennai,', 'India - Bangalore'],
  )
  assert.equal(
    normalizeQburstLocation('Multiple Cities, India', [
      'India - Trivandrum,',
      'India - Cochin,',
      'India - Chennai,',
      'India - Bangalore',
    ]),
    'Multiple Cities, India',
  )
  assert.deepEqual(
    buildJobFromDetail({
      summary: {
        jobId: 'DE-DEV/002',
        title: 'Associate Director/Director - AI-Native Engineering & Digital Experience',
        location: 'Multiple Cities, India',
        experienceRequired: '15 - 20 yrs',
      },
      detailLines,
      detailUrl: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      scrapedAt: '2026-08-01T00:00:00.000Z',
    }),
    {
      title: 'Associate Director/Director - AI-Native Engineering & Digital Experience',
      company: COMPANY,
      location: 'Multiple Cities, India',
      city: null,
      country: 'India',
      link: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      sourceUrl: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      applyUrl: 'https://www.qburst.com/en-in/company/career/openings/job-details/de-dev-002/',
      jobId: 'DE-DEV/002',
      requisitionId: 'DE-DEV/002',
      department: null,
      employmentType: null,
      remoteStatus: null,
      experienceRequired: '15 - 20 yrs',
      minimumQualification: 'Build and scale AI-native practices.',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Responsibilities: Build and scale AI-native practices. Requirements: Build and scale AI-native practices.',
      source: SOURCE,
      scrapedAt: '2026-08-01T00:00:00.000Z',
    },
  )
})

test('QBurst India rejects when the verified careers landing or openings surface drifts', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => (
        url === CAREERS_URL
          ? '<html><head><title>Example</title></head><body>Example</body></html>'
          : VERIFIED_EMPTY_OPENINGS_HTML
      ),
      scrapeJobs: async () => [],
    }),
    /careers landing page/i,
  )

  await assert.rejects(
    run({
      fetchHtml: async (url) => (
        url === CAREERS_URL
          ? VERIFIED_CAREERS_LANDING_HTML
          : '<html><head><title>Example</title></head><body>Example</body></html>'
      ),
      scrapeJobs: async () => [],
    }),
    /openings page/i,
  )
})
