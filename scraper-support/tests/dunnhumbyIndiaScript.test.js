import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at dunnhumby</title>
    <link rel="canonical" href="https://www.dunnhumby.com/careers/" />
    <meta property="og:url" content="https://www.dunnhumby.com/careers/" />
  </head>
  <body>
    <h1>Careers at dunnhumby</h1>
    <p>Discover where your talent can take you.</p>
    <a href="/work-with-us/">See open positions</a>
  </body>
</html>
`

const workWithUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work With Us</title>
    <link rel="canonical" href="https://www.dunnhumby.com/work-with-us/" />
    <meta property="og:url" content="https://www.dunnhumby.com/work-with-us/" />
  </head>
  <body>
    <section>
      <h1>Join the dunhumby team</h1>
      <p>Latest roles</p>
      <a href="https://job-boards.greenhouse.io/dunnhumby">See open positions</a>
    </section>
  </body>
</html>
`

const greenhouseBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at dunnhumby</title>
    <link rel="canonical" href="http://job-boards.greenhouse.io/dunnhumby" />
  </head>
  <body>
    <h1>Shape your future, discover new opportunities at dunnhumby</h1>
    <label for="office-filter">Office</label>
    <script>
      window.__INITIAL_STATE__ = {"board":{"name":"dunnhumby","public_url":"https://job-boards.greenhouse.io/dunnhumby","urlToken":"dunnhumby"}};
    </script>
    <div>Powered by</div>
    <a href="https://www.greenhouse.com/">Greenhouse</a>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7751065003,
      title: 'Senior Applied Data Scientist',
      location: { name: 'New Gurgaon' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003',
      requisition_id: 'DS-201',
      company_name: 'dunnhumby',
      updated_at: '2026-07-14T09:48:30-04:00',
      first_published: '2026-06-11T02:10:00-04:00',
      content: '&lt;p&gt;Build production retail science models for India clients.&lt;/p&gt;',
      departments: [{ name: 'Applied Data Science - EMEA' }],
      offices: [{ location: 'Gurugram' }],
    },
    {
      id: 7786118003,
      title: 'Applied Data Scientist',
      location: { name: 'Gurgaon' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003',
      requisition_id: 'DS-202',
      company_name: 'dunnhumby',
      updated_at: '2026-07-14T09:48:30-04:00',
      first_published: '2026-07-07T02:10:00-04:00',
      content: '&lt;p&gt;Solve price, promotions, and assortment analytics problems.&lt;/p&gt;',
      departments: [{ name: 'Applied Data Science - Price, Promotions &amp; Assortment' }],
      offices: [{ location: 'India' }],
    },
    {
      id: 7747263003,
      title: 'Lead Engineer - Workplace Technology & Automation',
      location: { name: 'London' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7747263003',
      requisition_id: 'TECH-999',
      company_name: 'dunnhumby',
      updated_at: '2026-07-14T09:48:30-04:00',
      first_published: '2026-05-27T07:50:47-04:00',
      content: '&lt;p&gt;London-only role.&lt;/p&gt;',
      departments: [{ name: 'Technology Enablement' }],
      offices: [{ location: 'London' }],
    },
  ],
}

const loadDunnhumbyIndiaModule = async () => {
  try {
    return await import('../../scraper/dunnhumbyindia/script.js')
  } catch {
    assert.fail('Expected Dunnhumby India scraper module at ../../scraper/dunnhumbyindia/script.js')
  }
}

test('Dunnhumby India verifies the first-party careers pages, Greenhouse board, and API constants', async () => {
  const dunnhumbyIndia = await loadDunnhumbyIndiaModule()

  assert.equal(dunnhumbyIndia.HOMEPAGE_URL, 'https://www.dunnhumby.com/')
  assert.equal(dunnhumbyIndia.CAREERS_LANDING_URL, 'https://www.dunnhumby.com/careers/')
  assert.equal(dunnhumbyIndia.WORK_WITH_US_URL, 'https://www.dunnhumby.com/work-with-us/')
  assert.equal(dunnhumbyIndia.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/dunnhumby')
  assert.equal(
    dunnhumbyIndia.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true',
  )
  assert.equal(dunnhumbyIndia.hasOfficialCareersSignal(careersLandingHtml), true)
  assert.equal(dunnhumbyIndia.hasWorkWithUsSignal(workWithUsHtml), true)
  assert.equal(dunnhumbyIndia.hasVerifiedGreenhouseBoardSignal(greenhouseBoardHtml), true)
  assert.equal(
    dunnhumbyIndia.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003',
      7751065003,
    ),
    'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003',
  )
  assert.equal(
    dunnhumbyIndia.buildGreenhouseApplyUrl(
      'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003',
      7751065003,
    ),
    'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003#application',
  )
})

test('Dunnhumby India extracts only India jobs from the verified Greenhouse payload', async () => {
  const dunnhumbyIndia = await loadDunnhumbyIndiaModule()

  const jobs = dunnhumbyIndia.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
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
        title: 'Senior Applied Data Scientist',
        location: 'New Gurgaon',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003',
        applyUrl: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003#application',
        department: 'Applied Data Science - EMEA',
      },
      {
        title: 'Applied Data Scientist',
        location: 'Gurgaon',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003',
        applyUrl: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003#application',
        department: 'Applied Data Science - Price, Promotions & Assortment',
      },
    ],
  )
  assert.equal(jobs[0].source, 'dunnhumbyindia')
  assert.match(jobs[0].jobDescription, /retail science models/i)
})

test('Dunnhumby India run validates the first-party careers pages and Greenhouse board before fetching the API', async () => {
  const dunnhumbyIndia = await loadDunnhumbyIndiaModule()
  const requested = []

  const jobs = await dunnhumbyIndia.createDunnhumbyIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === dunnhumbyIndia.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === dunnhumbyIndia.WORK_WITH_US_URL) return workWithUsHtml
      if (url === dunnhumbyIndia.GREENHOUSE_BOARD_URL) return greenhouseBoardHtml
      throw new Error(`Unexpected Dunnhumby India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: dunnhumbyIndia.CAREERS_LANDING_URL },
    { type: 'text', url: dunnhumbyIndia.WORK_WITH_US_URL },
    { type: 'text', url: dunnhumbyIndia.GREENHOUSE_BOARD_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dunnhumbyindia')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/dunnhumby/jobs/7751065003')
})

test('Dunnhumby India fails closed when the verified careers pages, Greenhouse board, or API drift materially', async () => {
  const dunnhumbyIndia = await loadDunnhumbyIndiaModule()

  await assert.rejects(
    dunnhumbyIndia.createDunnhumbyIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumbyIndia.CAREERS_LANDING_URL) {
          return careersLandingHtml.replace('See open positions', 'Browse opportunities')
        }
        throw new Error(`Unexpected Dunnhumby India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified dunnhumby careers landing page/i,
  )

  await assert.rejects(
    dunnhumbyIndia.createDunnhumbyIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumbyIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === dunnhumbyIndia.WORK_WITH_US_URL) {
          return workWithUsHtml.replace(
            'https://job-boards.greenhouse.io/dunnhumby',
            'https://job-boards.greenhouse.io/dunnhumby-old',
          )
        }
        throw new Error(`Unexpected Dunnhumby India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified dunnhumby work-with-us page/i,
  )

  await assert.rejects(
    dunnhumbyIndia.createDunnhumbyIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumbyIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === dunnhumbyIndia.WORK_WITH_US_URL) return workWithUsHtml
        if (url === dunnhumbyIndia.GREENHOUSE_BOARD_URL) {
          return greenhouseBoardHtml.replace('Powered by', 'Hosted by')
        }
        throw new Error(`Unexpected Dunnhumby India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified dunnhumby greenhouse board/i,
  )

  await assert.rejects(
    dunnhumbyIndia.createDunnhumbyIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumbyIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === dunnhumbyIndia.WORK_WITH_US_URL) return workWithUsHtml
        if (url === dunnhumbyIndia.GREENHOUSE_BOARD_URL) return greenhouseBoardHtml
        throw new Error(`Unexpected Dunnhumby India fixture URL: ${url}`)
      },
      fetchJson: async () => ({ jobs: null }),
    }),
    /Greenhouse jobs API response/i,
  )
})
