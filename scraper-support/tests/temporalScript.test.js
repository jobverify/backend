import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const OFFICIAL_ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Temporal</title>
    <link rel="canonical" href="https://temporal.io/about" />
  </head>
  <body>
    <main>
      <h1>Who We Are</h1>
      <p>Join us in shaping the future of technology, one line of code at a time.</p>
      <a href="https://job-boards.greenhouse.io/temporaltechnologies">Join Now</a>
      <section>
        <h2>We're Hiring!</h2>
        <a href="https://job-boards.greenhouse.io/temporaltechnologies">View All Openings</a>
      </section>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 6001001,
      title: 'Events & Field Marketing Manager - India',
      absolute_url: 'https://job-boards.greenhouse.io/temporaltechnologies/jobs/6001001',
      location: { name: 'India' },
      updated_at: '2026-07-24T10:00:00-04:00',
      first_published: '2026-07-02T10:00:00-04:00',
      requisition_id: 'TMPL-IND-001',
      content: '<p>Drive field marketing programs across India.</p>',
      departments: [{ name: 'Marketing' }],
      offices: [{ location: 'India' }],
      metadata: [],
    },
    {
      id: 6001002,
      title: 'Staff Software Engineer, AI Foundations',
      absolute_url: 'https://job-boards.greenhouse.io/temporaltechnologies/jobs/6001002',
      location: { name: 'United States, Remote Opportunity' },
      updated_at: '2026-07-23T10:00:00-04:00',
      first_published: '2026-07-07T10:00:00-04:00',
      requisition_id: 'TMPL-US-002',
      content: '<p>Build AI foundations.</p>',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'United States' }],
      metadata: [],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/temporal/script.js')
  } catch {
    assert.fail('Expected Temporal scraper module at ../../scraper/temporal/script.js')
  }
}

test('Temporal validates the verified first-party about page and official Greenhouse API handoff', async () => {
  const temporal = await loadModule()

  assert.equal(temporal.SOURCE, 'temporal')
  assert.equal(temporal.COMPANY, 'Temporal')
  assert.equal(temporal.OFFICIAL_BRAND_NAME, 'Temporal')
  assert.equal(temporal.VERIFIED_ON, '2026-09-03')
  assert.equal(temporal.CAREERS_PAGE_URL, 'https://temporal.io/about')
  assert.equal(temporal.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/temporaltechnologies')
  assert.equal(
    temporal.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/temporaltechnologies/jobs',
  )
  assert.equal(temporal.hasOfficialCareersSignal(OFFICIAL_ABOUT_HTML), true)
  assert.equal(
    temporal.extractGreenhouseBoardUrl(OFFICIAL_ABOUT_HTML),
    'https://job-boards.greenhouse.io/temporaltechnologies',
  )
  assert.equal(
    temporal.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/temporaltechnologies/jobs?content=true',
  )
})

test('Temporal returns only India roles from the verified Greenhouse board payload', async () => {
  const temporal = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await temporal.createTemporalScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return OFFICIAL_ABOUT_HTML
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return GREENHOUSE_PAYLOAD
    },
  })

  assert.deepEqual(requestedTextUrls, [temporal.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJsonUrls, [temporal.buildGreenhouseJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Events & Field Marketing Manager - India',
    company: 'Temporal',
    department: 'Marketing',
    location: 'India',
    city: 'India',
    country: 'India',
    jobId: '6001001',
    requisitionId: 'TMPL-IND-001',
    sourceUrl: 'https://job-boards.greenhouse.io/temporaltechnologies/jobs/6001001',
    applyUrl: 'https://job-boards.greenhouse.io/temporaltechnologies/jobs/6001001',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-02',
    closingDate: null,
    jobDescription: 'Drive field marketing programs across India.',
    source: 'temporal',
    link: 'https://job-boards.greenhouse.io/temporaltechnologies/jobs/6001001',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})
