import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T16:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Bloomreach</title>
    <link rel="canonical" href="https://www.bloomreach.com/en/careers" />
  </head>
  <body>
    <h1>Accelerate Your Career Growth</h1>
    <a href="https://job-boards.greenhouse.io/bloomreach/jobs/8053639">Senior Software Engineer</a>
    <a href="https://job-boards.greenhouse.io/bloomreach/jobs/8047161">Product Manager</a>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8053639,
      title: 'Senior Software Engineer',
      location: { name: 'Bengaluru, Karnataka, India' },
      absolute_url: 'https://job-boards.greenhouse.io/bloomreach/jobs/8053639',
      requisition_id: 'BR-101',
      company_name: 'Bloomreach',
      updated_at: '2026-07-14T10:00:00Z',
      content: '&lt;p&gt;Build products for ecommerce search and discovery.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
    {
      id: 8053640,
      title: 'Account Executive',
      location: { name: 'New York, New York, United States' },
      absolute_url: 'https://job-boards.greenhouse.io/bloomreach/jobs/8053640',
      requisition_id: 'BR-102',
      company_name: 'Bloomreach',
      updated_at: '2026-07-14T11:00:00Z',
      content: '&lt;p&gt;US sales role.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'New York, New York, United States' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
  ],
}

const loadBloomReachModule = async () => {
  try {
    return await import('../../scraper/bloomreach/script.js')
  } catch {
    assert.fail('Expected BloomReach scraper module at ../../scraper/bloomreach/script.js')
  }
}

test('BloomReach verifies the official careers page and Greenhouse API constants', async () => {
  const bloomReach = await loadBloomReachModule()

  assert.equal(bloomReach.CAREERS_URL, 'https://www.bloomreach.com/en/careers')
  assert.equal(bloomReach.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/bloomreach')
  assert.equal(
    bloomReach.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/bloomreach/jobs?content=true',
  )
  assert.equal(bloomReach.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    bloomReach.extractGreenhouseBoardUrl(officialCareersHtml),
    'https://job-boards.greenhouse.io/bloomreach',
  )
})

test('BloomReach extracts India jobs from the verified Greenhouse payload', async () => {
  const bloomReach = await loadBloomReachModule()

  const jobs = bloomReach.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Software Engineer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'bloomreach')
})

test('BloomReach run validates the official page before fetching the Greenhouse jobs API', async () => {
  const bloomReach = await loadBloomReachModule()
  const requested = []

  const jobs = await bloomReach.createBloomReachScraper({ maxJobs: 1 }).run({
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
    { type: 'text', url: bloomReach.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/bloomreach/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bloomreach')
})
