import assert from 'node:assert/strict'
import test from 'node:test'

const loadNetradyneModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Netradyne scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Netradyne | Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Careers at Netradyne</h1>
      <p>Thank you for your interest in Netradyne.</p>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=netradyne"></script>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4711352005,
      title: 'Business Operations Specialist',
      location: { name: 'Bengaluru, Karnataka, India' },
      absolute_url: 'https://www.netradyne.com/company/careers?gh_jid=4711352005',
      requisition_id: 'P001163-22-Aug-2026',
      company_name: 'Netradyne',
      updated_at: '2026-07-02T03:00:13-04:00',
      content:
        '&lt;p&gt;&lt;strong&gt;Job Title&lt;/strong&gt;: Business Operations Specialist&lt;/p&gt;'
        + '&lt;p&gt;&lt;strong&gt;Location&lt;/strong&gt;: Bengaluru, India&lt;br&gt;'
        + '&lt;strong&gt;Employment Type&lt;/strong&gt;: Full-time, on-site&lt;/p&gt;'
        + '&lt;p&gt;&lt;strong&gt;Experience&lt;/strong&gt;: 5-7 Years&lt;/p&gt;'
        + '&lt;p&gt;Support sales and operations workflows.&lt;/p&gt;',
      departments: [{ name: 'Biz Ops- Europe & APAC' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
    },
    {
      id: 4661199005,
      title: 'Backend - Senior Staff Engineer',
      location: { name: 'Bengaluru' },
      absolute_url: 'https://www.netradyne.com/company/careers?gh_jid=4661199005',
      requisition_id: '954',
      company_name: 'Netradyne',
      updated_at: '2026-07-01T06:01:25-04:00',
      content:
        '&lt;p&gt;&lt;strong&gt;Employment Type&lt;/strong&gt;: Full-time, on-site&lt;/p&gt;'
        + '&lt;p&gt;&lt;strong&gt;Experience&lt;/strong&gt;: 12+ Years&lt;/p&gt;'
        + '&lt;p&gt;Design and build backend platform services.&lt;/p&gt;',
      departments: [{ name: 'Cloud' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
    },
    {
      id: 4709305005,
      title: 'Account Executive, Mid-Market',
      location: { name: 'Remote' },
      absolute_url: 'https://www.netradyne.com/company/careers?gh_jid=4709305005',
      requisition_id: 'P001393-10-Mar-2026',
      company_name: 'Netradyne',
      updated_at: '2026-07-01T14:34:48-04:00',
      content: '&lt;p&gt;Grow the United States commercial pipeline.&lt;/p&gt;',
      departments: [{ name: 'RSM' }],
      offices: [{ location: 'San Diego, California, United States' }],
    },
  ],
}

test('Netradyne constants stay pinned to the verified first-party careers page and Greenhouse jobs API', async () => {
  const netradyne = await loadNetradyneModule()

  assert.equal(netradyne.SOURCE, 'netradyne')
  assert.equal(netradyne.COMPANY, 'Netradyne')
  assert.equal(netradyne.CAREERS_URL, 'https://www.netradyne.com/company/careers')
  assert.equal(
    netradyne.GREENHOUSE_EMBED_URL,
    'https://boards.greenhouse.io/embed/job_board/js?for=netradyne',
  )
  assert.equal(
    netradyne.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/netradyne/jobs',
  )
  assert.equal(
    netradyne.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/netradyne/jobs?content=true',
  )
  assert.equal(netradyne.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    netradyne.extractGreenhouseEmbedUrl(officialCareersHtml),
    netradyne.GREENHOUSE_EMBED_URL,
  )
  assert.equal(
    netradyne.normalizeGreenhouseJobUrl(
      'https://www.netradyne.com/company/careers?gh_jid=4711352005',
      4711352005,
    ),
    'https://www.netradyne.com/company/careers?gh_jid=4711352005',
  )
})

test('extractIndiaJobsFromGreenhousePayload keeps only India jobs and normalizes first-party gh_jid URLs', async () => {
  const netradyne = await loadNetradyneModule()

  const jobs = netradyne.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
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
        title: 'Business Operations Specialist',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://www.netradyne.com/company/careers?gh_jid=4711352005',
        applyUrl: 'https://www.netradyne.com/company/careers?gh_jid=4711352005',
        requisitionId: 'P001163-22-Aug-2026',
        department: 'Biz Ops- Europe & APAC',
        employmentType: 'Full-time',
        experienceRequired: '5-7 Years',
        remoteStatus: 'On-site',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Backend - Senior Staff Engineer',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://www.netradyne.com/company/careers?gh_jid=4661199005',
        applyUrl: 'https://www.netradyne.com/company/careers?gh_jid=4661199005',
        requisitionId: '954',
        department: 'Cloud',
        employmentType: 'Full-time',
        experienceRequired: '12+ Years',
        remoteStatus: 'On-site',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Support sales and operations workflows\./i)
  assert.match(jobs[1].jobDescription, /backend platform services/i)
})

test('Netradyne run validates the first-party careers page before fetching the public Greenhouse jobs feed', async () => {
  const netradyne = await loadNetradyneModule()
  const requestedPages = []
  const requestedJson = []

  const jobs = await netradyne.createNetradyneScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPages.push(url)
      assert.equal(url, netradyne.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return greenhousePayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedPages, [netradyne.CAREERS_URL])
  assert.deepEqual(requestedJson, [
    {
      url: netradyne.buildGreenhouseJobsApiUrl(),
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Business Operations Specialist')
  assert.equal(jobs[0].source, 'netradyne')
})

test('Netradyne fails closed when the verified careers page or first-party gh_jid job handoff changes', async () => {
  const netradyne = await loadNetradyneModule()

  await assert.rejects(
    netradyne.createNetradyneScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified official netradyne careers surface/i,
  )

  await assert.rejects(
    netradyne.createNetradyneScraper().run({
      fetchText: async () =>
        officialCareersHtml.replace(
          'https://boards.greenhouse.io/embed/job_board/js?for=netradyne',
          'https://boards.greenhouse.io/embed/job_board/js?for=other-company',
        ),
      fetchJson: async () => greenhousePayload,
    }),
    /verified greenhouse embed/i,
  )

  await assert.rejects(
    netradyne.createNetradyneScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.greenhouse.io/netradyne/jobs/4711352005',
          },
        ],
      }),
    }),
    /first-party gh_jid/i,
  )
})
