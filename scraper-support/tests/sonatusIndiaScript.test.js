import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Sonatus</title>
  </head>
  <body>
    <main>
      <section>
        <h1>Build the AI</h1>
        <h2>behind Smart Vehicles</h2>
        <p>We are using AI to solve exciting new challenges like turning vehicle data into intelligence.</p>
        <a href="https://job-boards.greenhouse.io/sonatus/"><span>View open positions</span></a>
      </section>
      <section>
        <h2>Join us around the world</h2>
        <div>India</div>
        <div>New Delhi</div>
      </section>
    </main>
  </body>
</html>
`

const greenhouseBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Sonatus</title>
  </head>
  <body>
    <main>
      <h1>Current openings at Sonatus</h1>
      <p>Sonatus is a well-funded, fast-paced, and rapidly growing company whose software products and solutions help automakers build dynamic software-defined vehicles.</p>
      <div>23 jobs</div>
      <section>
        <h2>Join Sonatus' Talent Community</h2>
        <p>Pune, India; Seoul, South Korea; Sunnyvale, CA</p>
      </section>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4662144007,
      internal_job_id: 4662144,
      title: 'Staff Cloud Backend Engineer',
      location: { name: 'Pune, India' },
      absolute_url: 'https://job-boards.greenhouse.io/sonatus/jobs/4662144007',
      requisition_id: 'SON-IND-001',
      company_name: 'Sonatus',
      updated_at: '2026-07-17T10:00:00Z',
      first_published: '2026-07-01T10:00:00Z',
      content: '&lt;p&gt;Build backend services for vehicle intelligence.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Pune, India' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
    {
      id: 5015947007,
      internal_job_id: 5015947,
      title: 'Manager, Engineering (Backend Development)',
      location: { name: 'Dublin, Ireland' },
      absolute_url: 'https://job-boards.greenhouse.io/sonatus/jobs/5015947007',
      requisition_id: 'SON-IRE-001',
      company_name: 'Sonatus',
      updated_at: '2026-07-17T11:00:00Z',
      first_published: '2026-07-01T11:00:00Z',
      content: '&lt;p&gt;Non-India role that should be filtered out.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Dublin, Ireland' }],
      metadata: [{ name: 'Country', value: 'Ireland' }],
    },
    {
      id: 9900000001,
      internal_job_id: null,
      title: "Sonatus Talent Community",
      location: { name: 'Pune, India; Seoul, South Korea' },
      absolute_url: 'https://job-boards.greenhouse.io/sonatus/jobs/9900000001',
      requisition_id: null,
      company_name: 'Sonatus',
      updated_at: '2026-07-17T09:00:00Z',
      first_published: '2026-07-17T09:00:00Z',
      content: '&lt;p&gt;Join Sonatus&#39; Talent Community.&lt;/p&gt;',
      departments: [],
      offices: [{ location: 'Pune, India' }, { location: 'Seoul, South Korea' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/sonatusindia/script.js')
  } catch {
    assert.fail('Expected Sonatus India scraper module at ../../scraper/sonatusindia/script.js')
  }
}

test('Sonatus India pins the verified careers page and Greenhouse board handoff', async () => {
  const sonatusIndia = await loadModule()

  assert.equal(sonatusIndia.SOURCE, 'sonatusindia')
  assert.equal(sonatusIndia.COMPANY, 'Sonatus India')
  assert.equal(sonatusIndia.OFFICIAL_BRAND_NAME, 'Sonatus')
  assert.equal(sonatusIndia.CAREERS_URL, 'https://www.sonatus.com/company/careers/')
  assert.equal(sonatusIndia.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/sonatus')
  assert.equal(
    sonatusIndia.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/sonatus/jobs?content=true',
  )
  assert.equal(
    sonatusIndia.extractOfficialGreenhouseBoardUrl(officialCareersHtml),
    sonatusIndia.GREENHOUSE_BOARD_URL,
  )
  assert.equal(sonatusIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(sonatusIndia.hasVerifiedGreenhouseBoardSignal(greenhouseBoardHtml), true)
  assert.equal(
    sonatusIndia.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/sonatus/jobs/4662144007?gh_src=test',
      4662144007,
    ),
    'https://job-boards.greenhouse.io/sonatus/jobs/4662144007',
  )
  assert.equal(
    sonatusIndia.normalizeGreenhouseApplyUrl(
      'https://job-boards.greenhouse.io/sonatus/jobs/4662144007',
      4662144007,
    ),
    'https://job-boards.greenhouse.io/sonatus/jobs/4662144007#application',
  )
})

test('Sonatus India extracts real India jobs from the Greenhouse payload and excludes the talent community prospect post', async () => {
  const sonatusIndia = await loadModule()

  const jobs = sonatusIndia.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Staff Cloud Backend Engineer',
    company: 'Sonatus India',
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/sonatus/jobs/4662144007',
    applyUrl: 'https://job-boards.greenhouse.io/sonatus/jobs/4662144007#application',
    sourceUrl: 'https://job-boards.greenhouse.io/sonatus/jobs/4662144007',
    source: 'sonatusindia',
    jobId: 4662144007,
    requisitionId: 'SON-IND-001',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build backend services for vehicle intelligence.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-17T10:00:00Z',
    remoteStatus: 'On-site',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('run validates the verified Sonatus careers page and Greenhouse board before fetching the jobs API', async () => {
  const sonatusIndia = await loadModule()
  const requested = []

  const jobs = await sonatusIndia.createSonatusIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === sonatusIndia.CAREERS_URL) return officialCareersHtml
      if (url === sonatusIndia.GREENHOUSE_BOARD_URL) return greenhouseBoardHtml
      throw new Error(`Unexpected Sonatus India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: sonatusIndia.CAREERS_URL },
    { type: 'text', url: sonatusIndia.GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/sonatus/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sonatusindia')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/sonatus/jobs/4662144007')
})

test('run fails closed when the verified Sonatus careers or Greenhouse board surfaces drift', async () => {
  const sonatusIndia = await loadModule()

  await assert.rejects(
    sonatusIndia.createSonatusIndiaScraper().run({
      fetchText: async (url) => {
        if (url === sonatusIndia.CAREERS_URL) {
          return officialCareersHtml.replace('View open positions', 'Browse openings')
        }
        throw new Error(`Unexpected Sonatus India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Sonatus careers page/i,
  )

  await assert.rejects(
    sonatusIndia.createSonatusIndiaScraper().run({
      fetchText: async (url) => {
        if (url === sonatusIndia.CAREERS_URL) return officialCareersHtml
        if (url === sonatusIndia.GREENHOUSE_BOARD_URL) {
          return greenhouseBoardHtml.replace('Current openings at Sonatus', 'Open roles at Sonatus')
        }
        throw new Error(`Unexpected Sonatus India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Sonatus Greenhouse board/i,
  )
})
