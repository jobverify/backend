import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Instabase</title>
  </head>
  <body>
    <section>
      <h1>Empowering AI for all</h1>
      <a href="/careers/jobs">View Open Positions</a>
      <a href="/why-instabase">Why Instabase</a>
      <p>Urgency of now</p>
      <p>Our office hubs include San Francisco, New York, London, and Bengaluru.</p>
    </section>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Instabase Careers</title>
  </head>
  <body>
    <section>
      <h2>Open positions</h2>
      <article>
        <h3>Product Marketing Manager, Competitive Intelligence (AI)</h3>
        <a href="https://job-boards.greenhouse.io/instabase/jobs/8560504002">Apply Now</a>
      </article>
      <article>
        <h3>Business Representative</h3>
        <a href="https://job-boards.greenhouse.io/instabase/jobs/8388006002">Apply Now</a>
      </article>
      <button type="button">Load More</button>
      <p>1 / 2</p>
    </section>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8560504002,
      title: 'Software Engineer, Backend (mid level)',
      location: { name: 'Bengaluru, India' },
      absolute_url: 'https://job-boards.greenhouse.io/instabase/jobs/8560504002',
      requisition_id: 'ENG-8560504002',
      company_name: 'Instabase',
      updated_at: '2026-07-10T17:17:05-04:00',
      first_published: '2026-07-08T02:11:56-04:00',
      content: '&lt;p&gt;Build resilient backend systems for the AI platform.&lt;/p&gt;&lt;h3&gt;About you:&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;2+ years of professional software development experience with strong CS fundamentals.&lt;/li&gt;&lt;/ul&gt;',
      departments: [{ name: 'Infra Engineering' }],
      offices: [{ location: 'Bengaluru, India' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
    {
      id: 8388006002,
      title: 'Staff Accountant',
      location: { name: 'Bengaluru, India' },
      absolute_url: 'https://job-boards.greenhouse.io/instabase/jobs/8388006002',
      requisition_id: 'FIN-8388006002',
      company_name: 'Instabase',
      updated_at: '2026-07-09T17:17:05-04:00',
      first_published: '2026-07-07T02:11:56-04:00',
      content: '&lt;p&gt;Support the accounting team in Bengaluru.&lt;/p&gt;',
      departments: [{ name: 'Finance' }],
      offices: [{ location: 'Bengaluru, India' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
    {
      id: 7000000001,
      title: 'Business Representative',
      location: { name: 'San Francisco, United States' },
      absolute_url: 'https://job-boards.greenhouse.io/instabase/jobs/7000000001',
      requisition_id: 'GTM-7000000001',
      company_name: 'Instabase',
      updated_at: '2026-07-08T17:17:05-04:00',
      first_published: '2026-07-06T02:11:56-04:00',
      content: '&lt;p&gt;United States role only.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'San Francisco, United States' }],
      metadata: [{ name: 'Country', value: 'United States' }],
    },
  ],
}

const loadInstabaseModule = async () => {
  try {
    return await import('../../scraper/instabase/script.js')
  } catch {
    assert.fail('Expected Instabase scraper module at ../../scraper/instabase/script.js')
  }
}

test('Instabase helpers stay pinned to the verified first-party careers pages and Greenhouse jobs API contract', async () => {
  const instabase = await loadInstabaseModule()

  assert.equal(instabase.CAREERS_URL, 'https://www.instabase.com/careers')
  assert.equal(instabase.JOBS_PAGE_URL, 'https://www.instabase.com/careers/jobs')
  assert.equal(instabase.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/instabase')
  assert.equal(
    instabase.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/instabase/jobs?content=true',
  )
  assert.equal(instabase.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(instabase.hasVerifiedJobsPageSignal(jobsPageHtml), true)
  assert.equal(
    instabase.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/instabase/jobs/8560504002',
      8560504002,
    ),
    'https://job-boards.greenhouse.io/instabase/jobs/8560504002',
  )
})

test('Instabase extracts only India jobs from the verified Greenhouse payload and preserves the official Greenhouse detail links', async () => {
  const instabase = await loadInstabaseModule()

  const jobs = instabase.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
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
        title: 'Software Engineer, Backend (mid level)',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/instabase/jobs/8560504002',
        applyUrl: 'https://job-boards.greenhouse.io/instabase/jobs/8560504002#application',
        department: 'Infra Engineering',
      },
      {
        title: 'Staff Accountant',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://job-boards.greenhouse.io/instabase/jobs/8388006002',
        applyUrl: 'https://job-boards.greenhouse.io/instabase/jobs/8388006002#application',
        department: 'Finance',
      },
    ],
  )
  assert.equal(jobs[0].source, 'instabase')
  assert.match(jobs[0].jobDescription, /backend systems/i)
  assert.equal(jobs[0].experienceRequired, '2+ years')
})

test('Instabase run validates the first-party pages before fetching the Greenhouse jobs API', async () => {
  const instabase = await loadInstabaseModule()
  const requested = []

  const jobs = await instabase.createInstabaseScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })

      if (url === instabase.CAREERS_URL) return officialCareersHtml
      if (url === instabase.JOBS_PAGE_URL) return jobsPageHtml

      throw new Error(`Unexpected Instabase fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: instabase.CAREERS_URL },
    { type: 'text', url: instabase.JOBS_PAGE_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/instabase/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'instabase')
  assert.equal(jobs[0].link, 'https://job-boards.greenhouse.io/instabase/jobs/8560504002')
})

test('Instabase run fails closed when the verified careers or jobs page drifts materially', async () => {
  const instabase = await loadInstabaseModule()

  await assert.rejects(
    instabase.createInstabaseScraper().run({
      fetchText: async (url) => {
        if (url === instabase.CAREERS_URL) {
          return officialCareersHtml.replace('View Open Positions', 'Browse Opportunities')
        }

        throw new Error(`Unexpected Instabase fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified first-party careers landing page/i,
  )

  await assert.rejects(
    instabase.createInstabaseScraper().run({
      fetchText: async (url) => {
        if (url === instabase.CAREERS_URL) return officialCareersHtml
        if (url === instabase.JOBS_PAGE_URL) {
          return jobsPageHtml.replace(
            /https:\/\/job-boards\.greenhouse\.io\/instabase\/jobs\/\d+/g,
            'https://jobs.example.com/instabase/changed',
          )
        }

        throw new Error(`Unexpected Instabase fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified first-party jobs page/i,
  )
})
