import assert from 'node:assert/strict'
import test from 'node:test'

const loadQuantboxResearchModule = async () => import('../../scraper/quantboxresearch/script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &mdash; Quantbox</title>
  </head>
  <body>
    <main>
      <h1>Build what markets need next.</h1>
      <a href="https://job-boards.eu.greenhouse.io/quantboxresearchpte">View current open roles</a>
      <a href="#open-roles">See open roles</a>
      <p>Current openings are listed below.</p>
      <p>Stay connected for what&#x27;s next</p>
      <p>Quantbox recruiting messages will come through our official channels.</p>
    </main>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001033101',
      id: 4001033101,
      requisition_id: '1',
      title: 'Experienced Quantitative Researcher ',
      company_name: 'Quantbox Research ',
      first_published: '2021-08-23T04:41:15-04:00',
      updated_at: '2026-06-12T00:26:34-04:00',
      content: '&lt;p&gt;Quantbox is a technology-driven Proprietary trading firm that specializes in systematic alpha research.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;li&gt;C++&lt;/li&gt;&lt;/ul&gt;',
      location: { name: 'Bengaluru, Karnataka, India; Hong Kong; Singapore, Central, Singapore' },
      departments: [{ name: 'Research & Trading' }],
      offices: [
        { location: 'Amsterdam, North Holland, Netherlands' },
        { location: 'Bengaluru, Karnataka, India' },
        { location: 'Singapore, Central, Singapore' },
      ],
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001696101',
      id: 4001696101,
      requisition_id: '3',
      title: 'FPGA Design & Verification Engineer',
      company_name: 'Quantbox Research ',
      first_published: '2021-10-04T21:37:45-04:00',
      content: '&lt;p&gt;Design low-latency trading hardware and verification flows.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;FPGA&lt;/li&gt;&lt;/ul&gt;',
      location: { name: 'Bengaluru, Karnataka, India' },
      departments: [{ name: 'Hardware ' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001979101',
      id: 4001979101,
      requisition_id: '8',
      title: 'Junior Quantitative Researcher',
      company_name: 'Quantbox Research ',
      first_published: '2021-10-04T21:37:57-04:00',
      content: '&lt;p&gt;Research and trading internship pathway for early-career candidates.&lt;/p&gt;',
      location: { name: 'Bengaluru, Karnataka, India; Singapore, Central, Singapore' },
      departments: [{ name: 'Research & Trading' }],
      offices: [
        { location: 'Bengaluru, Karnataka, India' },
        { location: 'Singapore, Central, Singapore' },
      ],
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4081386101',
      id: 4081386101,
      requisition_id: '10',
      title: 'Junior Quantitative Researcher - Amsterdam ',
      company_name: 'Quantbox Research ',
      first_published: '2022-09-22T01:09:31-04:00',
      content: '&lt;p&gt;Amsterdam role.&lt;/p&gt;',
      location: { name: 'Amsterdam, North Holland, Netherlands' },
      departments: [{ name: 'Research & Trading' }],
      offices: [{ location: 'Amsterdam, North Holland, Netherlands' }],
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4081385101',
      id: 4081385101,
      requisition_id: '9',
      title: 'Junior Software Developer - Amsterdam ',
      company_name: 'Quantbox Research ',
      first_published: '2022-09-22T01:09:11-04:00',
      content: '&lt;p&gt;Amsterdam software role.&lt;/p&gt;',
      location: { name: 'Amsterdam, North Holland, Netherlands' },
      departments: [{ name: 'Development ' }],
      offices: [{ location: 'Amsterdam, North Holland, Netherlands' }],
    },
    {
      absolute_url: 'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001041101',
      id: 4001041101,
      requisition_id: '2',
      title: 'Software Developer ',
      company_name: 'Quantbox Research ',
      first_published: '2021-10-04T21:38:29-04:00',
      content: '&lt;p&gt;Develop proprietary software for market-making systems.&lt;/p&gt;',
      location: { name: 'Bengaluru, Karnataka, India; Hong Kong; Singapore, Central, Singapore' },
      departments: [{ name: 'Development ' }],
      offices: [
        { location: 'Bengaluru, Karnataka, India' },
        { location: 'Hong Kong' },
      ],
    },
  ],
}

test('Quantbox Research validates the official first-party careers page and Greenhouse handoff', async () => {
  const quantboxResearch = await loadQuantboxResearchModule()

  assert.equal(quantboxResearch.CAREERS_URL, 'https://www.quantboxresearch.com/careers')
  assert.equal(quantboxResearch.GREENHOUSE_BOARD_URL, 'https://job-boards.eu.greenhouse.io/quantboxresearchpte')
  assert.equal(
    quantboxResearch.GREENHOUSE_JOBS_API_WITH_CONTENT_URL,
    'https://boards-api.greenhouse.io/v1/boards/quantboxresearchpte/jobs?content=true',
  )
  assert.equal(quantboxResearch.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    quantboxResearch.hasOfficialCareersSignal(
      careersHtml.replace('&mdash;', '—').replace("what&#x27;s", 'what’s'),
    ),
    true,
  )
  assert.equal(quantboxResearch.hasOfficialCareersSignal('<html><body><h1>Quantbox</h1></body></html>'), false)
})

test('Quantbox Research extracts only India jobs from the verified Greenhouse payload', async () => {
  const quantboxResearch = await loadQuantboxResearchModule()

  assert.equal(quantboxResearch.isIndiaJob(greenhousePayload.jobs[0]), true)
  assert.equal(quantboxResearch.isIndiaJob(greenhousePayload.jobs[3]), false)

  const jobs = quantboxResearch.extractJobsFromGreenhousePayload(greenhousePayload)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Experienced Quantitative Researcher',
    'FPGA Design & Verification Engineer',
    'Junior Quantitative Researcher',
    'Software Developer',
  ])
  assert.deepEqual(jobs.map((job) => job.location), [
    'Bengaluru, Karnataka, India',
    'Bengaluru, Karnataka, India',
    'Bengaluru, Karnataka, India',
    'Bengaluru, Karnataka, India',
  ])
  assert.deepEqual(jobs.map((job) => job.city), [
    'Bangalore',
    'Bangalore',
    'Bangalore',
    'Bangalore',
  ])
  assert.equal(jobs[0].department, 'Research & Trading')
  assert.equal(jobs[0].requiredSkills.join(','), 'Python,C++')
  assert.equal(jobs[1].department, 'Hardware')
  assert.equal(jobs[1].requiredSkills.join(','), 'FPGA')
  assert.equal(jobs[3].requisitionId, '2')
  assert.equal(jobs[0].postingDate, '2021-08-23')
  assert.match(jobs[0].jobDescription, /systematic alpha research/i)
})

test('Quantbox Research run validates the official careers page and returns normalized India jobs', async () => {
  const quantboxResearch = await loadQuantboxResearchModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await quantboxResearch.createQuantboxResearchScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      assert.equal(url, quantboxResearch.CAREERS_URL)
      return careersHtml
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      assert.equal(url, quantboxResearch.GREENHOUSE_JOBS_API_WITH_CONTENT_URL)
      return greenhousePayload
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [quantboxResearch.CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [quantboxResearch.GREENHOUSE_JOBS_API_WITH_CONTENT_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'quantboxresearch')
  assert.equal(
    jobs[0].link,
    'https://job-boards.eu.greenhouse.io/quantboxresearchpte/jobs/4001033101',
  )
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('Quantbox Research fails closed when the verified careers page or Greenhouse payload drifts', async () => {
  const quantboxResearch = await loadQuantboxResearchModule()

  await assert.rejects(
    quantboxResearch.createQuantboxResearchScraper().run({
      fetchText: async () => '<html><body><h1>Quantbox</h1></body></html>',
      fetchJson: async () => greenhousePayload,
    }),
    /Quantbox Research careers page no longer matches the verified first-party public jobs surface/i,
  )

  await assert.rejects(
    quantboxResearch.createQuantboxResearchScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async () => ({
        jobs: [
          {
            ...greenhousePayload.jobs[0],
            absolute_url: 'https://job-boards.eu.greenhouse.io/other/jobs/4001033101',
          },
        ],
      }),
    }),
    /Quantbox Research Greenhouse payload no longer exposes the verified public job detail URLs/i,
  )
})
