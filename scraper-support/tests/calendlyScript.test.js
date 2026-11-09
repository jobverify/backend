import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Let's make meetings better together | Calendly</title>
  </head>
  <body>
    <main>
      <p>Careers at Calendly</p>
      <h1>Join us in creating better meeting experiences</h1>
      <a href="https://job-boards.greenhouse.io/calendly">Explore open roles</a>
      <section>
        <h2>Open roles</h2>
        <p>Take a look at our open positions and join us on our mission to make people love meetings.</p>
      </section>
      <footer>
        <p>Copyright Calendly</p>
      </footer>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 9010011002,
      title: 'Senior Full Stack Engineer, Growth',
      absolute_url: 'https://job-boards.greenhouse.io/calendly/jobs/9010011002',
      company_name: 'Calendly',
      first_published: '2026-07-23T14:20:00-04:00',
      updated_at: '2026-07-24T10:30:00-04:00',
      content: '<p>Build product experiences for growth initiatives.</p>',
      location: { name: 'Remote - US' },
      departments: [{ name: 'Engineering' }],
      offices: [{ name: 'Remote', location: 'United States' }],
      metadata: [{ name: 'Country', value: 'United States' }],
    },
    {
      id: 9010011003,
      title: 'Staff Product Manager, New Products',
      absolute_url: 'https://job-boards.greenhouse.io/calendly/jobs/9010011003',
      company_name: 'Calendly',
      first_published: '2026-07-22T13:00:00-04:00',
      updated_at: '2026-07-24T09:00:00-04:00',
      content: '<p>Lead new product initiatives.</p>',
      location: { name: 'San Francisco (Hybrid)' },
      departments: [{ name: 'Product' }],
      offices: [{ name: 'San Francisco', location: 'San Francisco, California, United States' }],
      metadata: [{ name: 'Country', value: 'United States' }],
    },
  ],
  meta: {
    total: 2,
  },
}

const loadCalendlyModule = async () => {
  try {
    return await import('../../scraper/calendly/script.js')
  } catch {
    assert.fail('Expected Calendly scraper module at ../../scraper/calendly/script.js')
  }
}

test('Calendly pins the verified official careers page and Greenhouse board constants', async () => {
  const calendly = await loadCalendlyModule()

  assert.equal(calendly.SOURCE, 'calendly')
  assert.equal(calendly.COMPANY_NAME, 'Calendly')
  assert.equal(calendly.CAREERS_URL, 'https://calendly.com/careers')
  assert.equal(calendly.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/calendly')
  assert.equal(
    calendly.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true',
  )
  assert.equal(calendly.hasOfficialCareersPageSignal(verifiedCareersHtml), true)
  assert.equal(
    calendly.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/calendly/jobs/9010011002?gh_src=abc',
      9010011002,
    ),
    'https://job-boards.greenhouse.io/calendly/jobs/9010011002',
  )
})

test('Calendly returns an honest zero-job result while the verified public Greenhouse feed exposes no India roles', async () => {
  const calendly = await loadCalendlyModule()

  const extractedJobs = calendly.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(extractedJobs, [])

  const requested = []
  const jobs = await calendly.createCalendlyScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      return verifiedCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: calendly.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true',
      options: { method: 'GET' },
    },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/calendly/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Calendly fails closed when the verified careers page or Greenhouse company identity drifts', async () => {
  const calendly = await loadCalendlyModule()

  await assert.rejects(
    calendly.createCalendlyScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    calendly.createCalendlyScraper().run({
      fetchText: async () => verifiedCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            company_name: 'Different Company',
          },
        ],
        meta: { total: 1 },
      }),
    }),
    /verified company identity/i,
  )
})

test('Calendly accepts the live filter-based careers surface while the Greenhouse feed still has no India roles', async () => {
  const calendly = await loadCalendlyModule()

  const liveCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Let&#39;s make meetings better together | Calendly</title>
    </head>
    <body>
      <p>Careers at Calendly</p>
      <h1>Join us in helping people make space for what matters</h1>
      <p>Filter by location</p>
      <p>Filter by department</p>
      <h2>Featured</h2>
      <a href="https://boards.greenhouse.io/embed/job_app?for=calendly&token=1">Customer Success Manager II</a>
      <a href="https://boards.greenhouse.io/embed/job_app?for=calendly&token=2">Senior Director, Product Growth</a>
      <footer>
        <p>© Copyright Calendly 2026</p>
      </footer>
    </body>
  </html>
  `

  assert.equal(calendly.hasOfficialCareersPageSignal(liveCareersHtml), true)
  assert.deepEqual(
    calendly.extractIndiaJobsFromGreenhousePayload(greenhousePayload, { scrapedAt: FIXED_SCRAPED_AT }),
    [],
  )
})
