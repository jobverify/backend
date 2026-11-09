import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at NiCE</title>
  </head>
  <body>
    <main>
      <h1>Careers at NiCE</h1>
      <p>Ready to impact? Let's go!</p>
      <label for="search-jobs">Search Jobs</label>
      <div>India - Pune</div>
      <article>
        <h2>Cloud Operations Engineer</h2>
        <a href="https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101">Apply</a>
      </article>
      <article>
        <h2>Data Scientist, Actimize</h2>
        <a href="https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101">Apply</a>
      </article>
      <article>
        <h2>Technical Support Engineer</h2>
        <a href="https://boards.eu.greenhouse.io/nice/jobs/4762978101?gh_jid=4762978101">Apply</a>
      </article>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 4861487101,
      title: 'Cloud Operations Engineer',
      company_name: 'NICE',
      location: { name: 'India - Pune' },
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
      requisition_id: 'REQ-4861487101',
      updated_at: '2026-07-07T05:21:25-04:00',
      first_published: '2026-07-03T10:00:00-04:00',
      content: '&lt;p&gt;Support cloud operations for the NiCE platform in Pune.&lt;/p&gt;',
      departments: [{ name: 'Cloud Operations' }],
      offices: [{ name: 'India - Pune', location: 'India - Pune' }],
    },
    {
      id: 4846931101,
      title: 'AI Presales',
      company_name: 'NICE',
      location: { name: 'India - Mumbai' },
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4846931101?gh_jid=4846931101',
      requisition_id: 'REQ-4846931101',
      updated_at: '2026-06-10T03:15:59-04:00',
      first_published: '2026-06-05T09:00:00-04:00',
      content: '&lt;p&gt;Support presales conversations for India-based AI opportunities.&lt;/p&gt;',
      departments: [{ name: 'Sales' }],
      offices: [{ name: 'India - Mumbai', location: 'India - Mumbai' }],
    },
    {
      id: 4700000001,
      title: 'Senior Software Engineer',
      company_name: 'NICE',
      location: { name: 'USA - Remote' },
      absolute_url: 'https://boards.eu.greenhouse.io/nice/jobs/4700000001?gh_jid=4700000001',
      requisition_id: 'REQ-4700000001',
      updated_at: '2026-07-01T02:00:00-04:00',
      first_published: '2026-06-28T09:00:00-04:00',
      content: '&lt;p&gt;United States only role.&lt;/p&gt;',
      departments: [{ name: 'Engineering' }],
      offices: [{ name: 'USA - Remote', location: 'USA - Remote' }],
    },
  ],
}

const loadNiceIndiaModule = async () => {
  try {
    return await import('../../scraper/niceindia/script.js')
  } catch {
    assert.fail('Expected NICE India scraper module at ../../scraper/niceindia/script.js')
  }
}

test('NICE India helpers stay pinned to the verified first-party careers page and Greenhouse jobs API contract', async () => {
  const niceIndia = await loadNiceIndiaModule()

  assert.equal(niceIndia.SOURCE, 'niceindia')
  assert.equal(niceIndia.COMPANY, 'NICE India')
  assert.equal(niceIndia.OFFICIAL_BRAND_NAME, 'NiCE')
  assert.equal(niceIndia.CAREERS_URL, 'https://www.nice.com/careers/apply?location=India+-+Pune')
  assert.equal(niceIndia.CAREERS_LANDING_URL, 'https://www.nice.com/careers/apply')
  assert.equal(niceIndia.GREENHOUSE_BOARD_URL, 'https://boards.eu.greenhouse.io/nice')
  assert.equal(niceIndia.GREENHOUSE_JOBS_API_URL, 'https://boards-api.greenhouse.io/v1/boards/nice/jobs')
  assert.equal(
    niceIndia.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
  )
  assert.equal(niceIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(niceIndia.extractGreenhouseJobLinks(officialCareersHtml), [
    'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
    'https://boards.eu.greenhouse.io/nice/jobs/4913142101?gh_jid=4913142101',
    'https://boards.eu.greenhouse.io/nice/jobs/4762978101?gh_jid=4762978101',
  ])
  assert.equal(
    niceIndia.normalizeGreenhouseJobUrl(
      'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
      4861487101,
    ),
    'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
  )
})

test('NICE India extracts only India jobs from the verified Greenhouse payload and preserves the public detail links', async () => {
  const niceIndia = await loadNiceIndiaModule()

  const jobs = niceIndia.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Cloud Operations Engineer',
    company: 'NICE India',
    location: 'India - Pune',
    city: 'Pune',
    country: 'India',
    link: 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
    applyUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101#application',
    sourceUrl: 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
    source: 'niceindia',
    jobId: 4861487101,
    requisitionId: 'REQ-4861487101',
    department: 'Cloud Operations',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Support cloud operations for the NiCE platform in Pune.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07T05:21:25-04:00',
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-16T00:00:00.000Z',
  })
  assert.equal(jobs[1].title, 'AI Presales')
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(jobs[1].country, 'India')
})

test('NICE India run validates the first-party careers page before fetching the Greenhouse jobs API', async () => {
  const niceIndia = await loadNiceIndiaModule()
  const requested = []

  const jobs = await niceIndia.createNiceIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === niceIndia.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected NICE India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: niceIndia.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'niceindia')
  assert.equal(jobs[0].link, 'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101')
})

test('NICE India fails closed when the official careers page drifts or the Greenhouse payload stops matching NiCE', async () => {
  const niceIndia = await loadNiceIndiaModule()

  await assert.rejects(
    niceIndia.createNiceIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    niceIndia.createNiceIndiaScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            company_name: 'Different Company',
          },
        ],
      }),
    }),
    /verified company identity/i,
  )
})
