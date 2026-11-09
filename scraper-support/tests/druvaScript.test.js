import assert from 'node:assert/strict'
import test from 'node:test'

const loadDruvaModule = async () => {
  try {
    return await import('../../scraper/druva/script.js')
  } catch {
    assert.fail('Expected Druva scraper module at ../../scraper/druva/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Druva</title>
  </head>
  <body>
    <main>
      <h1>Where Innovation</h1>
      <h2>Meets Opportunity</h2>
      <a href="#job-search-area">See all our open positions</a>
      <script>
        const jobsApi = "https://boards-api.greenhouse.io/v1/boards/druva/jobs";
      </script>
      <a href="https://www.druva.com/about/careers/jobs/7679725002?gh_jid=7679725002">
        Join Druva's Talent Community
      </a>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8298455002,
      title: 'MSP Billing & Reporting Specialist',
      location: { name: 'Pune, Maharashtra, India' },
      absolute_url: 'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
      requisition_id: '2679',
      company_name: 'Druva',
      updated_at: '2026-06-25T09:41:04-04:00',
      first_published: '2025-12-08T04:59:46-05:00',
      content: '&lt;p&gt;&lt;strong&gt;About Druva&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;Manage inbound consumption data feeds.&lt;/p&gt;',
      departments: [{ name: 'Sales Operations' }],
      offices: [{ location: 'Pune, Maharashtra, India' }],
      metadata: null,
    },
    {
      id: 8308808002,
      title: 'Staff Software Engineer in Test',
      location: { name: 'Pune, Maharashtra, India' },
      absolute_url: 'https://www.druva.com/why-druva/explore/careers/jobs/8308808002/?gh_jid=8308808002',
      requisition_id: '2684',
      company_name: 'Druva',
      updated_at: '2026-06-09T17:45:56-04:00',
      first_published: '2025-12-11T06:44:37-05:00',
      content: '&lt;p&gt;&lt;strong&gt;The Role&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;We are looking for a highly skilled SDET to join our Agile development team.&lt;/p&gt;',
      departments: [{ name: 'Hybrid' }],
      offices: [{ location: 'Pune, Maharashtra, India' }],
      metadata: null,
    },
    {
      id: 7727374002,
      title: 'Bay Area Sales - Future Opportunities',
      location: { name: 'Santa Clara, CA' },
      absolute_url: 'https://www.druva.com/why-druva/explore/careers/jobs/7727374002/?gh_jid=7727374002',
      requisition_id: null,
      company_name: 'Druva',
      updated_at: '2026-05-19T04:42:48-04:00',
      first_published: '2024-11-12T16:00:38-05:00',
      content: '&lt;p&gt;US only role.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Santa Clara, California, United States' }],
      metadata: null,
    },
  ],
}

test('Druva constants stay pinned to the verified first-party careers shell and embedded Greenhouse API', async () => {
  const druva = await loadDruvaModule()

  assert.equal(druva.SOURCE, 'druva')
  assert.equal(druva.COMPANY, 'Druva')
  assert.equal(druva.OFFICIAL_BRAND_NAME, 'Druva')
  assert.equal(druva.VERIFIED_ON, '2026-07-15')
  assert.equal(druva.CAREERS_REDIRECT_URL, 'https://www.druva.com/careers')
  assert.equal(druva.CAREERS_URL, 'https://www.druva.com/why-druva/explore/careers')
  assert.equal(
    druva.JOB_DETAILS_BASE_URL,
    'https://www.druva.com/why-druva/explore/careers/jobs/',
  )
  assert.equal(
    druva.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/druva/jobs',
  )
  assert.equal(
    druva.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/druva/jobs?content=true',
  )
  assert.equal(druva.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    druva.normalizeGreenhouseJobUrl(
      'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
      8298455002,
    ),
    'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
  )
})

test('Druva extracts India jobs from the verified Greenhouse payload and preserves the first-party detail routes', async () => {
  const druva = await loadDruvaModule()

  const jobs = druva.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
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
      remoteStatus: job.remoteStatus,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'MSP Billing & Reporting Specialist',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        link: 'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
        applyUrl: 'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
        department: 'Sales Operations',
        remoteStatus: null,
        postingDate: '2026-06-25',
      },
      {
        title: 'Staff Software Engineer in Test',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        link: 'https://www.druva.com/why-druva/explore/careers/jobs/8308808002/?gh_jid=8308808002',
        applyUrl: 'https://www.druva.com/why-druva/explore/careers/jobs/8308808002/?gh_jid=8308808002',
        department: null,
        remoteStatus: 'Hybrid',
        postingDate: '2026-06-09',
      },
    ],
  )
  assert.equal(jobs[0].source, 'druva')
  assert.match(jobs[0].jobDescription, /Manage inbound consumption data feeds/i)
  assert.match(jobs[1].jobDescription, /highly skilled SDET/i)
})

test('run validates the first-party Druva careers shell before fetching the Greenhouse jobs API', async () => {
  const druva = await loadDruvaModule()
  const requested = []

  const jobs = await druva.createDruvaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === druva.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Druva fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: druva.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/druva/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'druva')
  assert.equal(
    jobs[0].link,
    'https://www.druva.com/why-druva/explore/careers/jobs/8298455002/?gh_jid=8298455002',
  )
})

test('run fails closed when the verified Druva careers shell or first-party Greenhouse detail route drifts materially', async () => {
  const druva = await loadDruvaModule()

  await assert.rejects(
    druva.createDruvaScraper().run({
      fetchText: async () => officialCareersHtml.replace('See all our open positions', 'Browse roles'),
      fetchJson: async () => greenhousePayload,
    }),
    /verified Druva careers page/i,
  )

  await assert.rejects(
    druva.createDruvaScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/druva/jobs/8298455002',
          },
        ],
      }),
    }),
    /verified first-party job detail route/i,
  )
})
