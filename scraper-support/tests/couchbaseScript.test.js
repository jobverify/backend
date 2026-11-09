import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T16:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Join the Couchbase Team - Careers</title>
    <link rel="canonical" href="https://www.couchbase.com/careers/" />
  </head>
  <body>
    <a href="https://www.couchbase.com/careers/#career">Explore Open Roles</a>
    <section
      id="career"
      class="open-positions bg-transparent"
      aria-label="Open Positions"
      data-api-url="https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs"
      data-bucket-id="4488138006"
    >
      <h2>Unlock your potential with career opportunities at Couchbase</h2>
      <input aria-label="Search open positions" />
    </section>
  </body>
</html>
`

const officialGreenhouseBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Couchbase, Inc.</title>
    <meta property="og:title" content="Couchbase, Inc." />
    <link rel="canonical" href="http://job-boards.greenhouse.io/couchbaseinc" />
  </head>
  <body>
    <main>
      <h1>Jobs at Couchbase, Inc.</h1>
      <p>Current openings at Couchbase, Inc.</p>
      <label>Search Department</label>
      <label>Office</label>
      <a href="https://job-boards.greenhouse.io/couchbaseinc/jobs/4649193006">Lead Software Engineer</a>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4649193006,
      title: 'Lead Software Engineer',
      location: { name: 'Bangalore, India' },
      absolute_url: 'https://job-boards.greenhouse.io/couchbaseinc/jobs/4649193006',
      requisition_id: '2475',
      company_name: 'Couchbase, Inc.',
      updated_at: '2026-06-11T10:45:20-04:00',
      first_published: '2026-03-05T00:18:33-05:00',
      content: '&lt;p&gt;Build distributed database features.&lt;/p&gt;',
      metadata: [{ name: 'Job Site Team', value: 'Engineering' }],
    },
    {
      id: 4692093006,
      title: 'Sr Solution Architect',
      location: { name: 'Bangalore, India' },
      absolute_url: 'https://job-boards.greenhouse.io/couchbaseinc/jobs/4692093006',
      requisition_id: '2628',
      company_name: 'Couchbase, Inc.',
      updated_at: '2026-07-09T07:06:40-04:00',
      first_published: '2026-07-09T07:06:40-04:00',
      metadata: [{ name: 'Job Site Team', value: 'Sales' }],
    },
    {
      id: 4680910006,
      title: 'Commercial Strategy Advisor (Deal Desk/Pricing)',
      location: { name: 'London, UK' },
      absolute_url: 'https://job-boards.greenhouse.io/couchbaseinc/jobs/4680910006',
      requisition_id: '2563',
      company_name: 'Couchbase, Inc.',
      updated_at: '2026-07-08T05:34:44-04:00',
      first_published: '2026-06-15T03:27:18-04:00',
      metadata: [{ name: 'Job Site Team', value: 'Sales' }],
    },
  ],
}

const loadCouchbaseModule = async () => {
  try {
    return await import('../../scraper/couchbase/script.js')
  } catch {
    assert.fail('Expected Couchbase scraper module at ../../scraper/couchbase/script.js')
  }
}

test('Couchbase verifies the official careers page and inline Greenhouse API contract', async () => {
  const couchbase = await loadCouchbaseModule()

  assert.equal(couchbase.CAREERS_URL, 'https://www.couchbase.com/careers/')
  assert.equal(couchbase.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/couchbaseinc')
  assert.equal(
    couchbase.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs',
  )
  assert.equal(couchbase.OPEN_POSITIONS_BUCKET_ID, '4488138006')
  assert.equal(
    couchbase.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs?content=true',
  )
  assert.equal(couchbase.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    couchbase.extractGreenhouseJobsApiUrl(officialCareersHtml),
    couchbase.GREENHOUSE_JOBS_API_URL,
  )
  assert.equal(
    couchbase.extractOpenPositionsBucketId(officialCareersHtml),
    couchbase.OPEN_POSITIONS_BUCKET_ID,
  )
})

test('Couchbase extracts India jobs from the verified Greenhouse payload', async () => {
  const couchbase = await loadCouchbaseModule()

  const jobs = couchbase.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      city: job.city,
      department: job.department,
      country: job.country,
      sourceUrl: job.sourceUrl,
      source: job.source,
    })),
    [
      {
        title: 'Lead Software Engineer',
        city: 'Bangalore',
        department: 'Engineering',
        country: 'India',
        sourceUrl: 'https://job-boards.greenhouse.io/couchbaseinc/jobs/4649193006',
        source: 'couchbase',
      },
      {
        title: 'Sr Solution Architect',
        city: 'Bangalore',
        department: 'Sales',
        country: 'India',
        sourceUrl: 'https://job-boards.greenhouse.io/couchbaseinc/jobs/4692093006',
        source: 'couchbase',
      },
    ],
  )
  assert.equal(jobs[0].company, 'Couchbase')
  assert.equal(jobs[0].requisitionId, '2475')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].jobDescription, '<p>Build distributed database features.</p>')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Couchbase run validates the official page before fetching the Greenhouse jobs API', async () => {
  const couchbase = await loadCouchbaseModule()
  const requested = []

  const jobs = await couchbase.createCouchbaseScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: couchbase.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'couchbase')
})

test('Couchbase falls back to the verified Greenhouse board when the first-party careers page is blocked', async () => {
  const couchbase = await loadCouchbaseModule()
  const requested = []

  const jobs = await couchbase.createCouchbaseScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === couchbase.CAREERS_URL) {
        throw new Error(`HTTP 403 for ${url}`)
      }
      if (url === couchbase.GREENHOUSE_BOARD_URL) {
        return officialGreenhouseBoardHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: couchbase.CAREERS_URL },
    { type: 'text', url: couchbase.GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/couchbaseinc/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'couchbase')
})
