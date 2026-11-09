import assert from 'node:assert/strict'
import test from 'node:test'

const firstPartyJobs = [
  {
    absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/7443309',
    id: 7443309,
    requisition_id: '10297',
    title: 'Applied Scientist III - Recommendation System',
    company_name: 'Glance',
    location: { name: 'Bangalore' },
    metadata: [
      { name: 'Base Country', value: ['India'] },
      { name: 'Employment Type', value: 'Full Time Employee' },
      { name: 'Department Name (Career Site)', value: 'Technology & Data Science' },
    ],
  },
  {
    absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/8020201',
    id: 8020201,
    requisition_id: '11183',
    title: 'Lead - Business Finance',
    company_name: 'Glance',
    location: { name: 'Bengaluru' },
    metadata: [
      { name: 'Base Country', value: ['India'] },
      { name: 'Employment Type', value: 'Full Time Employee' },
      { name: 'Department Name (Career Site)', value: 'Legal, Finance & Admin' },
    ],
  },
  {
    absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/7213756',
    id: 7213756,
    requisition_id: '9932',
    title: 'Director - Commerce Partnerships, Tokyo - Japan',
    company_name: 'Glance',
    location: { name: 'Tokyo' },
    metadata: [
      { name: 'Base Country', value: ['Japan'] },
      { name: 'Employment Type', value: 'Full Time Employee' },
      { name: 'Department Name (Career Site)', value: 'Sales & Business Development' },
    ],
  },
]

const buildCareersPageHtml = (jobs = firstPartyJobs) => `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers at Glance</h1>
      <p>Come build what millions see every day</p>
      <footer>Glance AI, Inc. &#169; 2026</footer>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      page: '/careers',
      props: {
        pageProps: {
          jobsDepartmentWise: {
            'Full Time Employee': jobs,
          },
        },
      },
    })}</script>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7443309,
      title: 'Applied Scientist III - Recommendation System',
      location: { name: 'Bangalore' },
      absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/7443309',
      requisition_id: '10297',
      company_name: 'Glance',
      updated_at: '2026-07-06T04:55:45-04:00',
      first_published: '2026-02-26T23:46:28-05:00',
      content: '&lt;p&gt;Build large-scale recommendation systems for Glance AI.&lt;/p&gt;',
      metadata: [
        { name: 'Base Country', value: ['India'] },
        { name: 'Employment Type', value: 'Full Time Employee' },
        { name: 'Department Name (Career Site)', value: 'Technology & Data Science' },
      ],
      offices: [{ location: 'Bangalore, Karnataka, India' }],
    },
    {
      id: 8020201,
      title: 'Lead - Business Finance',
      location: { name: 'Bengaluru' },
      absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/8020201',
      requisition_id: '11183',
      company_name: 'Glance',
      updated_at: '2026-06-30T05:13:31-04:00',
      first_published: '2026-06-30T05:13:31-04:00',
      content: '&lt;p&gt;Own finance planning and analysis for India growth initiatives.&lt;/p&gt;',
      metadata: [
        { name: 'Base Country', value: ['India'] },
        { name: 'Employment Type', value: 'Full Time Employee' },
        { name: 'Department Name (Career Site)', value: 'Legal, Finance & Admin' },
      ],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
    },
    {
      id: 7213756,
      title: 'Director - Commerce Partnerships, Tokyo - Japan',
      location: { name: 'Tokyo' },
      absolute_url: 'https://job-boards.greenhouse.io/glance/jobs/7213756',
      requisition_id: '9932',
      company_name: 'Glance',
      updated_at: '2026-06-29T11:37:00-04:00',
      first_published: '2026-05-30T00:17:23-04:00',
      content: '&lt;p&gt;Japan-only role.&lt;/p&gt;',
      metadata: [
        { name: 'Base Country', value: ['Japan'] },
        { name: 'Employment Type', value: 'Full Time Employee' },
        { name: 'Department Name (Career Site)', value: 'Sales & Business Development' },
      ],
      offices: [{ location: 'Tokyo, Japan' }],
    },
  ],
}

const loadGlanceModule = async () => {
  try {
    return await import('../../scraper/glance/script.js')
  } catch {
    assert.fail('Expected Glance scraper module at ../../scraper/glance/script.js')
  }
}

test('Glance pins the verified first-party careers page and Greenhouse handoff constants', async () => {
  const glance = await loadGlanceModule()

  assert.equal(glance.SOURCE, 'glance')
  assert.equal(glance.COMPANY, 'Glance')
  assert.equal(glance.OFFICIAL_BRAND_NAME, 'Glance AI')
  assert.equal(glance.CAREERS_URL, 'https://glance.com/careers')
  assert.equal(glance.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/glance')
  assert.equal(
    glance.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/glance/jobs?content=true',
  )
  assert.equal(glance.hasOfficialCareersPageSignal(buildCareersPageHtml()), true)
  assert.deepEqual(
    glance.extractEmbeddedFirstPartyJobs(buildCareersPageHtml()).map((job) => job.id),
    [7443309, 8020201, 7213756],
  )
  assert.equal(
    glance.normalizeGreenhouseApplyUrl('https://job-boards.greenhouse.io/glance/jobs/7443309', 7443309),
    'https://job-boards.greenhouse.io/glance/jobs/7443309',
  )
  assert.equal(glance.normalizeFirstPartyJobUrl(7443309), 'https://glance.com/careers/7443309')
})

test('Glance extracts only India jobs from the verified Greenhouse payload and canonicalizes them to first-party detail routes', async () => {
  const glance = await loadGlanceModule()

  const jobs = glance.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    allowedJobIds: new Set(['7443309', '8020201']),
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
      requisitionId: job.requisitionId,
      department: job.department,
      employmentType: job.employmentType,
    })),
    [
      {
        title: 'Applied Scientist III - Recommendation System',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://glance.com/careers/7443309',
        applyUrl: 'https://job-boards.greenhouse.io/glance/jobs/7443309',
        requisitionId: '10297',
        department: 'Technology & Data Science',
        employmentType: 'Full Time Employee',
      },
      {
        title: 'Lead - Business Finance',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        link: 'https://glance.com/careers/8020201',
        applyUrl: 'https://job-boards.greenhouse.io/glance/jobs/8020201',
        requisitionId: '11183',
        department: 'Legal, Finance & Admin',
        employmentType: 'Full Time Employee',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /recommendation systems/i)
})

test('Glance run validates the first-party careers page before fetching the public Greenhouse API', async () => {
  const glance = await loadGlanceModule()
  const requested = []

  const jobs = await glance.createGlanceScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === glance.CAREERS_URL) return buildCareersPageHtml()
      throw new Error(`Unexpected Glance fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: glance.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/glance/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'glance')
  assert.equal(jobs[0].company, 'Glance')
  assert.equal(jobs[0].link, 'https://glance.com/careers/7443309')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Glance fails closed when the first-party careers page or Greenhouse company identity drifts', async () => {
  const glance = await loadGlanceModule()

  await assert.rejects(
    glance.createGlanceScraper().run({
      fetchText: async () => buildCareersPageHtml([]),
      fetchJson: async () => greenhousePayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    glance.createGlanceScraper().run({
      fetchText: async () => buildCareersPageHtml(firstPartyJobs.slice(1)),
      fetchJson: async () => greenhousePayload,
    }),
    /first-party and Greenhouse job inventories disagree/i,
  )

  await assert.rejects(
    glance.createGlanceScraper().run({
      fetchText: async () => buildCareersPageHtml(),
      fetchJson: async () => ({
        jobs: greenhousePayload.jobs.map((job, index) => index === 0
          ? { ...job, company_name: 'Different Company' }
          : job),
      }),
    }),
    /verified company identity/i,
  )
})
