import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GHX Careers | GHX</title>
  </head>
  <body>
    <main>
      <h1>Boldly advancing healthcare. Will you join us?</h1>
      <a href="#featured-jobs" title="View all positions" class="btn">View all positions</a>
      <section id="featured-jobs">
        <div class="product-container">
          <h6>Customer Support Analyst II</h6>
          <button
            data-bs-applyurl="https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4717679005"
            class="btn btn-outline-dark btn-lg"
          >
            Apply
          </button>
        </div>
      </section>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4717679005,
      title: 'Customer Support Analyst II',
      company_name: 'GHX',
      absolute_url: 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4717679005',
      requisition_id: 'GHX-IND-001',
      location: { name: 'Hyderabad, Telangana, India' },
      updated_at: '2026-07-31T12:00:00Z',
      content: '<p>Support GHX customers from Hyderabad.</p>',
      offices: [{ location: 'Hyderabad, Telangana, India' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
      departments: [{ name: 'Customer Support' }],
    },
    {
      id: 4708559005,
      title: 'Enterprise Tech Administrator I',
      company_name: 'GHX',
      absolute_url: 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4708559005',
      requisition_id: 'GHX-IND-002',
      location: { name: 'Hyderabad, Telangana, India' },
      updated_at: '2026-07-30T12:00:00Z',
      content: '<p>Administer enterprise tools in Hyderabad.</p>',
      offices: [{ location: 'Hyderabad, Telangana, India' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
      departments: [{ name: 'IT' }],
    },
    {
      id: 4694276005,
      title: 'Commercial Development Associate (Hybrid Denver, CO)',
      company_name: 'GHX',
      absolute_url: 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4694276005',
      requisition_id: 'GHX-US-001',
      location: { name: 'Denver, Colorado, United States' },
      updated_at: '2026-07-29T12:00:00Z',
      content: '<p>US-only role.</p>',
      offices: [{ location: 'Denver, Colorado, United States' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
      departments: [{ name: 'Sales' }],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/ghxindia/script.js')
  } catch {
    assert.fail('Expected GHX India scraper module at ../../scraper/ghxindia/script.js')
  }
}

test('GHX India accepts the current GHX careers shell and keeps India jobs from the Greenhouse payload', async () => {
  const ghxIndia = await loadModule()

  assert.equal(ghxIndia.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(ghxIndia.buildGreenhouseJobsApiUrl(), 'https://boards-api.greenhouse.io/v1/boards/globalhealthcareexchangeinc/jobs?content=true')
  assert.equal(
    ghxIndia.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
      scrapedAt: '2026-08-02T00:00:00.000Z',
    }).length,
    2,
  )
})

test('GHX India run validates the current first-party careers page before fetching the Greenhouse API', async () => {
  const ghxIndia = await loadModule()
  const requested = []

  const jobs = await ghxIndia.createGhxIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === ghxIndia.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected GHX India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: ghxIndia.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/globalhealthcareexchangeinc/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ghxindia')
  assert.equal(jobs[0].company, 'GHX India')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
})
