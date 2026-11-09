import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Tower Research Capital</title>
  </head>
  <body>
    <section>
      <h1>Build Your Career at Tower</h1>
      <p>Continuous investment in top trading and engineering talent is our not-so-secret sauce.</p>
      <p>Explore our open roles and move one step closer to reaching your full potential.</p>
      <a href="https://tower-research.com/roles/">Explore Open Roles</a>
    </section>
  </body>
</html>
`

const ROLES_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Roles - Tower Research Capital</title>
  </head>
  <body>
    <section>
      <p>The next chapter of your career starts here. Explore open roles across our departments and global offices.</p>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=towerresearchcapital"></script>
    </section>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD = {
  jobs: [
    {
      id: 7912545,
      title: 'AI Operations Manager',
      location: { name: 'gurugram' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=7912545',
      company_name: 'Tower Research Capital',
      updated_at: '2026-06-19T01:04:34-04:00',
      requisition_id: 'REQ-7912545',
      content: '&lt;p&gt;Lead automation initiatives across AI operations.&lt;/p&gt;',
      departments: [{ name: 'Core AI and Machine Learning' }],
      offices: [{ location: 'Gurgaon, Haryana, India', name: 'Gurgaon' }],
    },
    {
      id: 16619,
      title: 'Experienced Quantitative Trader',
      location: { name: 'Multiple Locations' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=16619',
      company_name: 'Tower Research Capital',
      updated_at: '2025-10-13T10:36:21-04:00',
      requisition_id: '798',
      content: '&lt;p&gt;Trade globally across Tower&apos;s markets business.&lt;/p&gt;',
      departments: [{ name: 'Quantitative Research & Trading' }],
      offices: [
        { location: 'Amsterdam, Noord-Holland, Netherlands', name: 'Amsterdam' },
        { location: 'Gurgaon, Haryana, India', name: 'Gurgaon' },
        { location: 'Singapore', name: 'Singapore' },
      ],
    },
    {
      id: 8040185,
      title: 'Senior Associate, Payroll & Benefits',
      location: { name: 'Hong Kong' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=8040185',
      company_name: 'Tower Research Capital',
      updated_at: '2026-06-30T22:40:01-04:00',
      requisition_id: 'R2592',
      content: '&lt;p&gt;Hong Kong variant.&lt;/p&gt;',
      departments: [{ name: 'Human Resources' }],
      offices: [
        { location: 'Gurgaon, Haryana, India', name: 'Gurgaon' },
        { location: 'Hong Kong Island, Hong Kong', name: 'Hong Kong' },
        { location: 'Singapore', name: 'Singapore' },
      ],
    },
    {
      id: 8040186,
      title: 'Senior Associate, Payroll & Benefits',
      location: { name: 'Gurgaon' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=8040186',
      company_name: 'Tower Research Capital',
      updated_at: '2026-06-30T22:40:02-04:00',
      requisition_id: 'R2592',
      content: '&lt;p&gt;Gurgaon variant.&lt;/p&gt;',
      departments: [{ name: 'Human Resources' }],
      offices: [
        { location: 'Gurgaon, Haryana, India', name: 'Gurgaon' },
        { location: 'Hong Kong Island, Hong Kong', name: 'Hong Kong' },
        { location: 'Singapore', name: 'Singapore' },
      ],
    },
    {
      id: 8040184,
      title: 'Senior Associate, Payroll & Benefits',
      location: { name: 'Singapore' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=8040184',
      company_name: 'Tower Research Capital',
      updated_at: '2026-06-30T22:40:00-04:00',
      requisition_id: 'R2592',
      content: '&lt;p&gt;Singapore variant.&lt;/p&gt;',
      departments: [{ name: 'Human Resources' }],
      offices: [
        { location: 'Gurgaon, Haryana, India', name: 'Gurgaon' },
        { location: 'Hong Kong Island, Hong Kong', name: 'Hong Kong' },
        { location: 'Singapore', name: 'Singapore' },
      ],
    },
    {
      id: 7704976,
      title: 'Information Security Analyst',
      location: { name: 'Montreal' },
      absolute_url: 'https://www.tower-research.com/open-positions/?gh_jid=7704976',
      company_name: 'Tower Research Capital',
      updated_at: '2026-07-09T14:58:59-04:00',
      requisition_id: 'REQ-7704976',
      content: '&lt;p&gt;Canada-only role.&lt;/p&gt;',
      departments: [{ name: 'Information Security and Enterprise Engineering' }],
      offices: [{ location: 'Montreal, Quebec, Canada', name: 'Montreal' }],
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/towerresearchcapital/script.js')
  } catch {
    assert.fail('Expected Tower Research Capital scraper module at ../../scraper/towerresearchcapital/script.js')
  }
}

test('Tower Research Capital verifies the first-party careers pages and extracts only India-primary or India-inclusive multi-location jobs', async () => {
  const towerResearchCapital = await loadScriptModule()

  assert.equal(towerResearchCapital.SOURCE, 'towerresearchcapital')
  assert.equal(towerResearchCapital.COMPANY, 'Tower Research Capital')
  assert.equal(towerResearchCapital.OFFICIAL_BRAND_NAME, 'Tower Research Capital')
  assert.equal(towerResearchCapital.CAREERS_URL, 'https://tower-research.com/careers/')
  assert.equal(towerResearchCapital.ROLES_URL, 'https://tower-research.com/roles/')
  assert.equal(towerResearchCapital.JOB_DETAILS_BASE_URL, 'https://www.tower-research.com/open-positions/')
  assert.equal(
    towerResearchCapital.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs?content=true',
  )
  assert.equal(towerResearchCapital.hasOfficialCareersLandingSignal(CAREERS_HTML), true)
  assert.equal(towerResearchCapital.hasVerifiedRolesPageSignal(ROLES_HTML), true)
  assert.equal(
    towerResearchCapital.normalizeGreenhouseJobUrl(
      'https://www.tower-research.com/open-positions/?gh_jid=7912545',
      7912545,
    ),
    'https://www.tower-research.com/open-positions/?gh_jid=7912545',
  )

  const jobs = towerResearchCapital.extractIndiaJobsFromGreenhousePayload(GREENHOUSE_PAYLOAD, {
    scrapedAt: '2026-08-06T00:00:00.000Z',
  })

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
        title: 'AI Operations Manager',
        location: 'Gurgaon, Haryana, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://www.tower-research.com/open-positions/?gh_jid=7912545',
        applyUrl: 'https://www.tower-research.com/open-positions/?gh_jid=7912545',
        department: 'Core AI and Machine Learning',
      },
      {
        title: 'Experienced Quantitative Trader',
        location: 'Gurgaon, Haryana, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://www.tower-research.com/open-positions/?gh_jid=16619',
        applyUrl: 'https://www.tower-research.com/open-positions/?gh_jid=16619',
        department: 'Quantitative Research & Trading',
      },
      {
        title: 'Senior Associate, Payroll & Benefits',
        location: 'Gurgaon, Haryana, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://www.tower-research.com/open-positions/?gh_jid=8040186',
        applyUrl: 'https://www.tower-research.com/open-positions/?gh_jid=8040186',
        department: 'Human Resources',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Lead automation initiatives/i)
  assert.equal(
    jobs.some((job) => job.link === 'https://www.tower-research.com/open-positions/?gh_jid=8040185'),
    false,
  )
  assert.equal(
    jobs.some((job) => job.link === 'https://www.tower-research.com/open-positions/?gh_jid=8040184'),
    false,
  )
})

test('Tower Research Capital run validates the verified first-party pages before fetching the Greenhouse jobs API and fails closed on drift', async () => {
  const towerResearchCapital = await loadScriptModule()
  const requested = []

  const jobs = await towerResearchCapital.createTowerResearchCapitalScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === towerResearchCapital.CAREERS_URL) return CAREERS_HTML
      if (url === towerResearchCapital.ROLES_URL) return ROLES_HTML
      throw new Error(`Unexpected Tower Research Capital fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return GREENHOUSE_PAYLOAD
    },
    now: () => '2026-08-06T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: towerResearchCapital.CAREERS_URL },
    { type: 'text', url: towerResearchCapital.ROLES_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'towerresearchcapital')
  assert.equal(jobs[0].link, 'https://www.tower-research.com/open-positions/?gh_jid=7912545')
  assert.equal(jobs[1].link, 'https://www.tower-research.com/open-positions/?gh_jid=16619')

  await assert.rejects(
    towerResearchCapital.createTowerResearchCapitalScraper().run({
      fetchText: async (url) => {
        if (url === towerResearchCapital.CAREERS_URL) {
          return CAREERS_HTML.replace(
            'Explore our open roles and move one step closer to reaching your full potential.',
            'Browse our open roles.',
          )
        }
        throw new Error(`Unexpected Tower Research Capital fixture URL: ${url}`)
      },
      fetchJson: async () => GREENHOUSE_PAYLOAD,
    }),
    /verified careers landing page/i,
  )
})
