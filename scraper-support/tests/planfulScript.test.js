import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join the Planful Team | Planful Jobs</title>
    <link rel="canonical" href="https://planful.com/jobs/" />
    <meta name="description" content="Planful is hiring! With a top-talent team, exciting products, and growing customer base, we’re taking the market by storm. Join us!" />
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Planful is hiring! With a top-talent team, exciting products, and growing customer base, we’re taking the market by storm. Join us!</p>
      <a href="/jobs/careers-list/">Search Jobs</a>
      <span>Hyderabad</span>
    </main>
  </body>
</html>
`

const currentOfficialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-react-helmet="true">Open Roles at Planful | Planful Careers</title>
    <meta name="description" content="Open Roles at Planful and join the team building the future of financial performance management." />
  </head>
  <body>
    <main>
      <h2>A team of Champions</h2>
      <a href="/jobs/careers-list/">Join Our Team</a>
      <p>Your ideas. Your actions. Your spirit.</p>
      <section>
        <h3>We take care of our people</h3>
      </section>
      <section>
        <a href="/life-at-planful/">Learn About Life at Planful</a>
      </section>
    </main>
  </body>
</html>
`

const careersListHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers List - Planful</title>
  </head>
  <body>
    <main>
      <h1>Join Our Journey</h1>
      <div id="grnhse_app"></div>
      <a href="/jobs/">Careers</a>
    </main>
  </body>
</html>
`

const currentCareersListHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title data-react-helmet="true">Open Roles at Planful | Planful Careers</title>
  </head>
  <body>
    <main>
      <h1>Your Planful Journey Begins Today</h1>
      <span>Team</span>
      <span>Location</span>
      <button>Reset</button>
      <script>window.__PLANFUL_GREENHOUSE__ = true;</script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8627819002,
      title: 'Senior NOC Engineer',
      location: { name: 'Hyderabad' },
      absolute_url: 'https://planful.com/jobs/careers-list/?gh_jid=8627819002',
      requisition_id: '840',
      company_name: 'Planful',
      updated_at: '2026-07-10T06:22:10-04:00',
      first_published: '2026-07-10T06:22:10-04:00',
      content: '&lt;h1&gt;About Planful&lt;/h1&gt;&lt;p&gt;Support highly available SaaS operations in Hyderabad.&lt;/p&gt;',
      departments: [{ name: 'Hosting Operations' }],
      offices: [{ name: 'Hyderabad', location: 'Madhapur, Hyderabad, India' }],
    },
    {
      id: 8507480002,
      title: 'Implementation Consultant',
      location: { name: 'Remote, North America' },
      absolute_url: 'https://planful.com/jobs/careers-list/?gh_jid=8507480002',
      requisition_id: '824',
      company_name: 'Planful',
      updated_at: '2026-06-01T15:11:53-04:00',
      first_published: '2026-04-14T19:48:15-04:00',
      content: '&lt;p&gt;North America only role.&lt;/p&gt;',
      departments: [{ name: 'Professional Services' }],
      offices: [{ name: 'Remote (North America)', location: 'Remote, North America' }],
    },
  ],
}

const loadPlanfulModule = async () => {
  try {
    return await import('../../scraper/planful/script.js')
  } catch {
    assert.fail('Expected Planful scraper module at ../../scraper/planful/script.js')
  }
}

test('Planful helpers stay pinned to the verified first-party careers pages and Greenhouse jobs API contract', async () => {
  const planful = await loadPlanfulModule()

  assert.equal(planful.SOURCE, 'planful')
  assert.equal(planful.COMPANY, 'Planful')
  assert.equal(planful.OFFICIAL_BRAND_NAME, 'Planful')
  assert.equal(planful.CAREERS_URL, 'https://planful.com/jobs/')
  assert.equal(planful.JOB_LISTING_URL, 'https://planful.com/jobs/careers-list/')
  assert.equal(planful.GREENHOUSE_JOBS_API_URL, 'https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs')
  assert.equal(
    planful.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs?content=true',
  )
  assert.equal(planful.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(planful.hasVerifiedJobListingSignal(careersListHtml), true)
  assert.equal(
    planful.normalizeGreenhouseJobUrl(
      'https://planful.com/jobs/careers-list/?gh_jid=8627819002',
      8627819002,
    ),
    'https://planful.com/jobs/careers-list/?gh_jid=8627819002',
  )
})

test('Planful accepts the current August 14, 2026 first-party careers shells', async () => {
  const planful = await loadPlanfulModule()

  assert.equal(planful.hasOfficialCareersSignal(currentOfficialCareersHtml), true)
  assert.equal(planful.hasVerifiedJobListingSignal(currentCareersListHtml), true)
})

test('Planful extracts the current India Greenhouse payload and preserves the first-party detail URL', async () => {
  const planful = await loadPlanfulModule()

  const jobs = planful.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      department: job.department,
    })),
    [
      {
        title: 'Senior NOC Engineer',
        location: 'Madhapur, Hyderabad, India',
        city: 'Hyderabad',
        country: 'India',
        link: 'https://planful.com/jobs/careers-list/?gh_jid=8627819002',
        applyUrl: 'https://planful.com/jobs/careers-list/?gh_jid=8627819002',
        department: 'Hosting Operations',
      },
    ],
  )
  assert.equal(jobs[0].source, 'planful')
  assert.match(jobs[0].jobDescription, /SaaS operations in Hyderabad/i)
})

test('Planful run validates the first-party careers pages before fetching the Greenhouse jobs API', async () => {
  const planful = await loadPlanfulModule()
  const requested = []

  const jobs = await planful.createPlanfulScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === planful.CAREERS_URL) return officialCareersHtml
      if (url === planful.JOB_LISTING_URL) return careersListHtml
      throw new Error(`Unexpected Planful fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: planful.CAREERS_URL },
    { type: 'text', url: planful.JOB_LISTING_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'planful')
  assert.equal(jobs[0].link, 'https://planful.com/jobs/careers-list/?gh_jid=8627819002')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Planful fails closed when the verified first-party careers pages or Greenhouse identity drift materially', async () => {
  const planful = await loadPlanfulModule()

  await assert.rejects(
    planful.createPlanfulScraper().run({
      fetchText: async (url) => {
        if (url === planful.CAREERS_URL) {
          return officialCareersHtml.replace('Join Our Team', 'Build With Us')
        }
        throw new Error(`Unexpected Planful fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Planful careers landing page/i,
  )

  await assert.rejects(
    planful.createPlanfulScraper().run({
      fetchText: async (url) => {
        if (url === planful.CAREERS_URL) return officialCareersHtml
        if (url === planful.JOB_LISTING_URL) {
          return careersListHtml.replace('Join Our Journey', 'Explore Roles')
        }
        throw new Error(`Unexpected Planful fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Planful careers list page/i,
  )

  await assert.rejects(
    planful.createPlanfulScraper().run({
      fetchText: async (url) => {
        if (url === planful.CAREERS_URL) return officialCareersHtml
        if (url === planful.JOB_LISTING_URL) return careersListHtml
        throw new Error(`Unexpected Planful fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [{
          ...greenhousePayload.jobs[0],
          company_name: 'Different Company',
        }],
      }),
    }),
    /company identity/i,
  )

  await assert.rejects(
    planful.createPlanfulScraper().run({
      fetchText: async (url) => {
        if (url === planful.CAREERS_URL) return officialCareersHtml
        if (url === planful.JOB_LISTING_URL) return careersListHtml
        throw new Error(`Unexpected Planful fixture URL: ${url}`)
      },
      fetchJson: async () => ({
        jobs: [{
          ...greenhousePayload.jobs[0],
          company_name: undefined,
        }],
      }),
    }),
    /company identity/i,
  )
})
