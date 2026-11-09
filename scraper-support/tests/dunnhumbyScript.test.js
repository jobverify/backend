import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at dunnhumby</title>
  </head>
  <body>
    <main>
      <h1>Careers at dunnhumby</h1>
      <a href="https://job-boards.greenhouse.io/dunnhumby">See open positions</a>
      <a href="https://www.dunnhumby.com/work-with-us/">Join us</a>
    </main>
  </body>
</html>
`

const officialWorkWithUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work With Us</title>
  </head>
  <body>
    <main>
      <h1>Work With Us</h1>
      <p>See open positions across our teams.</p>
      <a href="https://job-boards.greenhouse.io/dunnhumby">See open positions</a>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7674368003,
      title: 'AI Engineering Manager - Global Infra',
      location: { name: 'Gurgaon' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003',
      requisition_id: 'TI4.117-2026-03-20',
      company_name: 'dunnhumby',
      updated_at: '2026-07-14T09:48:30-04:00',
      content: '&lt;p&gt;Lead global infrastructure and AI engineering initiatives.&lt;/p&gt;',
      departments: [{ name: 'Infrastructure & Operations' }],
      offices: [{ name: 'Gurugram', location: 'Gurugram' }],
      metadata: [
        { name: 'Full Time / Part Time', value: 'Full Time' },
        { name: 'Careers Pages Web-Hook', value: 'Technology & Product' },
      ],
    },
    {
      id: 7786118003,
      title: 'Applied Data Scientist',
      location: { name: 'New Gurgaon' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003',
      requisition_id: 'DA2.249-2026-06-25',
      company_name: 'dunnhumby',
      updated_at: '2026-07-14T09:48:30-04:00',
      content: '&lt;p&gt;Design and productionize applied data science models.&lt;/p&gt;',
      departments: [{ name: 'Data Science' }],
      offices: [{ name: 'Gurugram', location: 'Gurugram' }],
      metadata: [
        { name: 'Full Time / Part Time', value: 'Full Time' },
        { name: 'Careers Pages Web-Hook', value: 'Data science' },
      ],
    },
    {
      id: 7000000001,
      title: 'Senior Commercial Analyst',
      location: { name: 'London' },
      absolute_url: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7000000001',
      requisition_id: 'COM-UK-1',
      company_name: 'dunnhumby',
      updated_at: '2026-07-10T09:48:30-04:00',
      content: '&lt;p&gt;United Kingdom role only.&lt;/p&gt;',
      departments: [{ name: 'Commercial' }],
      offices: [{ name: 'London', location: 'London' }],
      metadata: [{ name: 'Full Time / Part Time', value: 'Full Time' }],
    },
  ],
}

const loadDunnhumbyModule = async () => {
  try {
    return await import('../../scraper/dunnhumby/script.js')
  } catch {
    assert.fail('Expected Dunnhumby scraper module at ../../scraper/dunnhumby/script.js')
  }
}

test('Dunnhumby helpers keep the verified first-party careers pages and Greenhouse jobs API pinned', async () => {
  const dunnhumby = await loadDunnhumbyModule()

  assert.equal(dunnhumby.SOURCE, 'dunnhumby')
  assert.equal(dunnhumby.COMPANY, 'Dunnhumby')
  assert.equal(dunnhumby.OFFICIAL_BRAND_NAME, 'dunnhumby')
  assert.equal(dunnhumby.VERIFIED_ON, '2026-07-15')
  assert.equal(dunnhumby.CAREERS_URL, 'https://www.dunnhumby.com/careers/')
  assert.equal(dunnhumby.WORK_WITH_US_URL, 'https://www.dunnhumby.com/work-with-us/')
  assert.equal(dunnhumby.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/dunnhumby')
  assert.equal(
    dunnhumby.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true',
  )
  assert.equal(dunnhumby.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(dunnhumby.hasOfficialWorkWithUsSignal(officialWorkWithUsHtml), true)
  assert.equal(
    dunnhumby.extractGreenhouseBoardUrl(officialCareersHtml),
    'https://job-boards.greenhouse.io/dunnhumby',
  )
  assert.equal(
    dunnhumby.extractGreenhouseBoardUrl(officialWorkWithUsHtml),
    'https://job-boards.greenhouse.io/dunnhumby',
  )
  assert.equal(
    dunnhumby.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003',
      7674368003,
    ),
    'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003',
  )
})

test('Dunnhumby extracts only India jobs from the verified Greenhouse payload and preserves the public Greenhouse detail URLs', async () => {
  const dunnhumby = await loadDunnhumbyModule()

  const jobs = dunnhumby.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
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
      employmentType: job.employmentType,
      postingDate: job.postingDate,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'AI Engineering Manager - Global Infra',
        location: 'Gurugram',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003',
        applyUrl: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003',
        department: 'Infrastructure & Operations',
        employmentType: 'Full Time',
        postingDate: '2026-07-14',
        remoteStatus: 'On-site',
      },
      {
        title: 'Applied Data Scientist',
        location: 'Gurugram',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003',
        applyUrl: 'https://job-boards.greenhouse.io/dunnhumby/jobs/7786118003',
        department: 'Data Science',
        employmentType: 'Full Time',
        postingDate: '2026-07-14',
        remoteStatus: 'On-site',
      },
    ],
  )
  assert.equal(jobs[0].source, 'dunnhumby')
  assert.match(jobs[0].jobDescription, /global infrastructure and AI engineering/i)
  assert.match(jobs[1].jobDescription, /applied data science models/i)
})

test('run validates both verified first-party careers pages before fetching the Greenhouse jobs API', async () => {
  const dunnhumby = await loadDunnhumbyModule()
  const requested = []

  const jobs = await dunnhumby.createDunnhumbyScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === dunnhumby.CAREERS_URL) return officialCareersHtml
      if (url === dunnhumby.WORK_WITH_US_URL) return officialWorkWithUsHtml
      throw new Error(`Unexpected Dunnhumby fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: dunnhumby.CAREERS_URL },
    { type: 'text', url: dunnhumby.WORK_WITH_US_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dunnhumby')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/dunnhumby/jobs/7674368003')
})

test('run fails closed when the verified Dunnhumby careers pages or Greenhouse detail route drift materially', async () => {
  const dunnhumby = await loadDunnhumbyModule()

  await assert.rejects(
    dunnhumby.createDunnhumbyScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumby.CAREERS_URL) {
          return officialCareersHtml.replace('See open positions', 'Browse roles')
        }
        return officialWorkWithUsHtml
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Dunnhumby careers landing page/i,
  )

  await assert.rejects(
    dunnhumby.createDunnhumbyScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumby.CAREERS_URL) return officialCareersHtml
        return officialWorkWithUsHtml.replace(
          'https://job-boards.greenhouse.io/dunnhumby',
          'https://job-boards.greenhouse.io/dunnhumby-careers',
        )
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Dunnhumby work with us page/i,
  )

  await assert.rejects(
    dunnhumby.createDunnhumbyScraper().run({
      fetchText: async (url) => {
        if (url === dunnhumby.CAREERS_URL) return officialCareersHtml
        return officialWorkWithUsHtml
      },
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/other-company/jobs/7674368003',
          },
        ],
      }),
    }),
    /verified public Greenhouse job detail URLs/i,
  )
})
