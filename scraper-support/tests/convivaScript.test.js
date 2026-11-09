import assert from 'node:assert/strict'
import test from 'node:test'

const loadConvivaModule = async () => {
  try {
    return await import('../../scraper/conviva/script.js')
  } catch {
    assert.fail('Expected Conviva scraper module at ../../scraper/conviva/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Job Listings – Join the Conviva Team</title>
    <link rel="canonical" href="https://www.conviva.ai/job-listings/" />
  </head>
  <body>
    <main>
      <p class="eyebrow">Careers</p>
      <h1>Choose Innovation</h1>
      <p>Join Conviva in reinventing the future of streaming big data.</p>
      <div class="job-openings">
        <div id="openings"></div>
        <div id="app"></div>
      </div>
      <script src="https://www.conviva.ai/wp-content/themes/conviva2025/src/js/greenhouse-integration.js?ver=1"></script>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=conviva"></script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7771001003,
      title: 'Senior Software Engineer',
      location: { name: 'Bengaluru, Karnataka, India' },
      absolute_url: 'https://www.conviva.ai/careers/job/7771001003?gh_jid=7771001003',
      requisition_id: 'CONV-101',
      company_name: 'Conviva',
      updated_at: '2026-07-14T10:00:00Z',
      content:
        '&lt;p&gt;&lt;strong&gt;Employment Type&lt;/strong&gt;: Full-time, hybrid&lt;/p&gt;'
        + '&lt;p&gt;&lt;strong&gt;Experience&lt;/strong&gt;: 6+ years&lt;/p&gt;'
        + '&lt;p&gt;Build AI-native analytics services from Bengaluru.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
    },
    {
      id: 7771001004,
      title: 'Account Executive',
      location: { name: 'Foster City, CA' },
      absolute_url: 'https://www.conviva.ai/careers/job/7771001004?gh_jid=7771001004',
      requisition_id: 'CONV-102',
      company_name: 'Conviva',
      updated_at: '2026-07-14T11:00:00Z',
      content: '&lt;p&gt;US go-to-market role.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Foster City, CA' }],
    },
  ],
}

test('Conviva constants stay pinned to the verified first-party careers page and Greenhouse jobs API', async () => {
  const conviva = await loadConvivaModule()

  assert.equal(conviva.SOURCE, 'conviva')
  assert.equal(conviva.COMPANY, 'Conviva')
  assert.equal(conviva.CAREERS_URL, 'https://www.conviva.ai/job-listings/')
  assert.equal(
    conviva.GREENHOUSE_EMBED_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=conviva',
  )
  assert.equal(
    conviva.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/conviva/jobs',
  )
  assert.equal(
    conviva.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/conviva/jobs?content=true',
  )
  assert.equal(conviva.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    conviva.extractGreenhouseEmbedUrl(officialCareersHtml),
    conviva.GREENHOUSE_EMBED_URL,
  )
  assert.equal(
    conviva.normalizeGreenhouseJobUrl(
      'https://www.conviva.ai/careers/job/7771001003?gh_jid=7771001003',
      7771001003,
    ),
    'https://www.conviva.ai/careers/job/7771001003?gh_jid=7771001003',
  )
})

test('extractIndiaJobsFromGreenhousePayload keeps only India jobs and normalizes first-party gh_jid URLs', async () => {
  const conviva = await loadConvivaModule()

  const jobs = conviva.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-14T16:00:00.000Z',
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
      requisitionId: job.requisitionId,
      department: job.department,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      remoteStatus: job.remoteStatus,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Software Engineer',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://www.conviva.ai/careers/job/7771001003?gh_jid=7771001003',
        applyUrl: 'https://www.conviva.ai/careers/job/7771001003?gh_jid=7771001003',
        requisitionId: 'CONV-101',
        department: 'Engineering',
        employmentType: 'Full-time',
        experienceRequired: '6+ years',
        remoteStatus: 'Hybrid',
        scrapedAt: '2026-07-14T16:00:00.000Z',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /AI-native analytics services/i)
})

test('Conviva run validates the first-party careers page before fetching the public Greenhouse jobs feed', async () => {
  const conviva = await loadConvivaModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await conviva.createConvivaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPages.push(url)
      assert.equal(url, conviva.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return greenhousePayload
    },
    now: () => '2026-07-14T16:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [conviva.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    {
      url: conviva.buildGreenhouseJobsApiUrl(),
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Software Engineer')
  assert.equal(jobs[0].source, 'conviva')
})

test('Conviva rejects unverified careers pages, embed bindings and mismatched job identities', async () => {
  const conviva = await loadConvivaModule()

  await assert.rejects(
    conviva.createConvivaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified official conviva careers surface/i,
  )

  await assert.rejects(
    conviva.createConvivaScraper().run({
      fetchText: async () =>
        officialCareersHtml.replace(
          'https://boards.greenhouse.io/embed/job_board/js?for=conviva',
          'https://boards.greenhouse.io/embed/job_board/js?for=other-company',
        ),
      fetchJson: async () => greenhousePayload,
    }),
    /verified greenhouse embed/i,
  )

  await assert.rejects(
    conviva.createConvivaScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/conviva/jobs/7771001004',
          },
        ],
      }),
    }),
    /first-party gh_jid/i,
  )
})
