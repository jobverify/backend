import assert from 'node:assert/strict'
import test from 'node:test'

const loadReltioModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Reltio scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Check Out Our Current Open Positions - Reltio</title>
    <link rel="canonical" href="https://www.reltio.com/careers/open-positions/" />
  </head>
  <body>
    <main>
      <h1 class="header-style--h2"><span>Open Positions</span><br />at Reltio</h1>
      <h2 class="header-style--h2"><span>Careers at Reltio</span></h2>
      <div id="grnhse_app"></div>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=reltio"></script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 6099262004,
      title: 'Advanced Customer Engineer',
      location: { name: 'Bangalore' },
      absolute_url: 'https://job-boards.greenhouse.io/reltio/jobs/6099262004',
      requisition_id: '1193',
      company_name: 'Reltio',
      updated_at: '2026-07-09T00:33:30-04:00',
      content:
        '&lt;p&gt;Support Reltio customers from Bangalore.&lt;/p&gt;'
        + '&lt;p&gt;This role partners closely with engineering teams.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Bangalore' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
    {
      id: 6104584004,
      title: 'Principal UI Engineer',
      location: { name: 'United States' },
      absolute_url: 'https://job-boards.greenhouse.io/reltio/jobs/6104584004',
      requisition_id: '1199',
      company_name: 'Reltio',
      updated_at: '2026-07-01T09:42:40-04:00',
      content: '&lt;p&gt;US-only role.&lt;/p&gt;',
      departments: [{ name: 'Technology' }],
      offices: [{ location: 'US' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
    {
      id: 5913450004,
      title: 'Senior Engineer',
      location: { name: 'Bengaluru' },
      absolute_url: 'https://job-boards.greenhouse.io/reltio/jobs/5913450004',
      requisition_id: '1138',
      company_name: 'Reltio',
      updated_at: '2026-05-04T08:30:30-04:00',
      content:
        '&lt;p&gt;Build platform services.&lt;/p&gt;'
        + '&lt;p&gt;This is a hybrid role based in Bengaluru.&lt;/p&gt;',
      departments: [{ name: 'Technology' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
      metadata: [{ name: 'Employment Type', value: 'Full-time' }],
    },
  ],
}

test('Reltio constants stay pinned to the verified first-party careers page and Greenhouse jobs API', async () => {
  const reltio = await loadReltioModule()

  assert.equal(reltio.SOURCE, 'reltio')
  assert.equal(reltio.COMPANY, 'Reltio')
  assert.equal(reltio.CAREERS_URL, 'https://www.reltio.com/careers/open-positions/')
  assert.equal(
    reltio.GREENHOUSE_EMBED_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=reltio',
  )
  assert.equal(reltio.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/reltio')
  assert.equal(
    reltio.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/reltio/jobs',
  )
  assert.equal(
    reltio.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/reltio/jobs?content=true',
  )
  assert.equal(reltio.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(reltio.extractGreenhouseEmbedUrl(officialCareersHtml), reltio.GREENHOUSE_EMBED_URL)
  assert.equal(
    reltio.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/reltio/jobs/6099262004',
      6099262004,
    ),
    'https://job-boards.greenhouse.io/reltio/jobs/6099262004',
  )
})

test('extractIndiaJobsFromGreenhousePayload keeps only India jobs from the verified Reltio board', async () => {
  const reltio = await loadReltioModule()

  const jobs = reltio.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-11T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      requisitionId: job.requisitionId,
      department: job.department,
      employmentType: job.employmentType,
      remoteStatus: job.remoteStatus,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Advanced Customer Engineer',
        location: 'Bangalore',
        city: 'Bangalore',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/reltio/jobs/6099262004',
        requisitionId: '1193',
        department: 'Sales',
        employmentType: 'Full-time',
        remoteStatus: 'On-site',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Senior Engineer',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/reltio/jobs/5913450004',
        requisitionId: '1138',
        department: 'Technology',
        employmentType: 'Full-time',
        remoteStatus: 'Hybrid',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Support Reltio customers/i)
  assert.match(jobs[1].jobDescription, /hybrid role based in Bengaluru/i)
})

test('Reltio run validates the first-party careers page before fetching the public Greenhouse jobs feed', async () => {
  const reltio = await loadReltioModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await reltio.createReltioScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPages.push(url)
      assert.equal(url, reltio.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return greenhousePayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [reltio.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    {
      url: reltio.buildGreenhouseJobsApiUrl(),
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Advanced Customer Engineer')
  assert.equal(jobs[0].source, 'reltio')
})

test('Reltio fails closed when the verified careers page, board embed, or job URLs change', async () => {
  const reltio = await loadReltioModule()

  await assert.rejects(
    reltio.createReltioScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified official reltio open positions surface/i,
  )

  await assert.rejects(
    reltio.createReltioScraper().run({
      fetchText: async () =>
        officialCareersHtml.replace(
          'https://boards.greenhouse.io/embed/job_board/js?for=reltio',
          'https://boards.greenhouse.io/embed/job_board/js?for=other-company',
        ),
      fetchJson: async () => greenhousePayload,
    }),
    /verified greenhouse embed/i,
  )

  await assert.rejects(
    reltio.createReltioScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/other-company/jobs/6099262004',
          },
        ],
      }),
    }),
    /verified public greenhouse job detail urls/i,
  )
})
