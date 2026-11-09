import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-19T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Tenon</title>
  </head>
  <body>
    <main>
      <h1 class="hero_h1">Tenon</h1>
      <p>
        At Tenon, we're on a mission to provide marketers with the tools they need
        to streamline marketing work from start to finish.
      </p>
      <a href="https://job-boards.greenhouse.io/tenon">See Open Positions</a>
    </main>
  </body>
</html>
`

const GREENHOUSE_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Tenon</title>
  </head>
  <body>
    <main>
      <h1>Current openings at Tenon</h1>
      <p>
        Tenon is the leader in enterprise marketing workflows. Built on ServiceNow,
        we provide a single source of truth for marketing teams to execute campaigns,
        projects, and marketing work.
      </p>
      <section>
        <h2>Engineering</h2>
        <a href="https://job-boards.greenhouse.io/tenon/jobs/8067766">
          Associate ServiceNow Technical Consultant
        </a>
        <p>Indianapolis, IN</p>
      </section>
      <button>Create a Job Alert</button>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 8067766,
      internal_job_id: 8067766,
      title: 'Associate ServiceNow Technical Consultant',
      location: { name: 'Indianapolis, IN' },
      absolute_url: 'https://job-boards.greenhouse.io/tenon/jobs/8067766',
      requisition_id: null,
      company_name: 'Tenon',
      updated_at: '2026-07-17T10:00:00Z',
      first_published: '2026-07-17T10:00:00Z',
      content: '&lt;p&gt;Built on ServiceNow for enterprise marketing workflows.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Indianapolis, IN' }],
      metadata: [],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/tenon/script.js')
  } catch {
    assert.fail('Expected Tenon scraper module at ../../scraper/tenon/script.js')
  }
}

test('Tenon pins the verified first-party careers handoff and Greenhouse API contract', async () => {
  const tenon = await loadModule()

  assert.equal(tenon.SOURCE, 'tenon')
  assert.equal(tenon.COMPANY, 'Tenon')
  assert.equal(tenon.OFFICIAL_BRAND_NAME, 'Tenon')
  assert.equal(tenon.VERIFIED_ON, '2026-07-19')
  assert.equal(tenon.CAREERS_URL, 'https://www.tenonhq.com/join-us')
  assert.equal(tenon.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/tenon')
  assert.equal(
    tenon.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/tenon/jobs?content=true',
  )
  assert.equal(
    tenon.extractOfficialGreenhouseBoardUrl(OFFICIAL_CAREERS_HTML),
    tenon.GREENHOUSE_BOARD_URL,
  )
  assert.equal(tenon.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    tenon.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(tenon.hasVerifiedGreenhouseBoardSignal(GREENHOUSE_BOARD_HTML), true)
  assert.equal(
    tenon.hasVerifiedGreenhouseBoardSignal('<html><body><h1>Jobs</h1></body></html>'),
    false,
  )
  assert.equal(
    tenon.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/tenon/jobs/8067766?gh_src=test',
      8067766,
    ),
    'https://job-boards.greenhouse.io/tenon/jobs/8067766',
  )
  assert.equal(
    tenon.normalizeGreenhouseJobUrl('https://boards.greenhouse.io/tenon/jobs/8067766', 8067766),
    'https://job-boards.greenhouse.io/tenon/jobs/8067766',
  )
  assert.equal(
    tenon.normalizeGreenhouseApplyUrl(
      'https://job-boards.greenhouse.io/tenon/jobs/8067766',
      8067766,
    ),
    'https://job-boards.greenhouse.io/tenon/jobs/8067766#application',
  )
  assert.deepEqual(
    tenon.extractIndiaJobsFromGreenhousePayload(GREENHOUSE_PAYLOAD, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [],
  )
})

test('Tenon run validates the first-party careers shell and currently returns no India jobs from Greenhouse', async () => {
  const tenon = await loadModule()
  const requested = []

  const jobs = await tenon.createTenonScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === tenon.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === tenon.GREENHOUSE_BOARD_URL) return GREENHOUSE_BOARD_HTML
      throw new Error(`Unexpected Tenon fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return GREENHOUSE_PAYLOAD
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: tenon.CAREERS_URL },
    { type: 'text', url: tenon.GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/tenon/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Tenon fails closed when the verified careers page, Greenhouse board, or board identity drifts', async () => {
  const tenon = await loadModule()

  await assert.rejects(
    tenon.createTenonScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /verified Tenon careers page/i,
  )

  await assert.rejects(
    tenon.createTenonScraper().run({
      fetchText: async (url) => {
        if (url === tenon.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === tenon.GREENHOUSE_BOARD_URL) {
          return GREENHOUSE_BOARD_HTML.replace('Current openings at Tenon', 'Open roles at Tenon')
        }
        throw new Error(`Unexpected Tenon fixture URL: ${url}`)
      },
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /verified Tenon Greenhouse board/i,
  )

  await assert.rejects(
    tenon.createTenonScraper().run({
      fetchText: async (url) => {
        if (url === tenon.CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === tenon.GREENHOUSE_BOARD_URL) return GREENHOUSE_BOARD_HTML
        throw new Error(`Unexpected Tenon fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: GREENHOUSE_PAYLOAD.jobs.map((job) => ({
          ...job,
          company_name: 'Another Company',
        })),
      }),
    }),
    /verified company identity/i,
  )
})
