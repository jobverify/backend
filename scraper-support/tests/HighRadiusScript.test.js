import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const buildCareersPageHtml = () => `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at HighRadius | Get a Career High!</title>
    <link rel="canonical" href="https://www.highradius.com/about/career/" />
  </head>
  <body>
    <section>
      <h1>Join us</h1>
      <a href="https://www.highradius.com/about/careers-list/?gh_jid=6542907003">Account Executive - Enterprise Net-New</a>
      <a href="https://www.highradius.com/about/careers-list/?gh_jid=7611164003">Agent Developer Test III</a>
      <a href="https://www.highradius.com/about/careers-list/?gh_jid=7701514003">Analyst - Strategic Alliances</a>
      <p>Explore Opportunities</p>
      <h2>Find Your Best Fit</h2>
      <span>Select Location</span>
      <span>Hyderabad, Telangana, India</span>
      <span>Select Department</span>
      <span>Product &amp; Engineering</span>
    </section>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 7611164003,
      title: 'Agent Developer Test III',
      location: { name: 'Hyderabad, Telangana, India' },
      absolute_url: 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
      requisition_id: '20260205',
      company_name: 'HighRadius',
      updated_at: '2026-06-23T08:16:55-04:00',
      first_published: '2026-06-08T05:28:06-04:00',
      content: '&lt;p&gt;Design and implement robust test automation frameworks.&lt;/p&gt;',
      metadata: [
        { name: 'Sub Department', value: 'Product CFOTech AP & Payments' },
        { name: 'Remote Position', value: false },
        { name: 'Experience Range', value: ['5.1 to 7.0 Years'] },
      ],
      departments: [{ name: 'Product & Engineering' }],
      offices: [{ location: 'Hyderabad, Telangana, India' }],
    },
    {
      id: 7701514003,
      title: 'Analyst - Strategic Alliances',
      location: { name: 'Hyderabad, Telangana, India' },
      absolute_url: 'https://www.highradius.com/about/careers-list/?gh_jid=7701514003',
      requisition_id: '20260409',
      company_name: 'HighRadius',
      updated_at: '2026-06-23T08:16:55-04:00',
      first_published: '2026-04-20T06:15:11-04:00',
      content: '&lt;p&gt;Drive partnership strategy with research and stakeholder management.&lt;/p&gt;',
      metadata: [
        { name: 'Sub Department', value: 'Sales Strategic Alliance' },
        { name: 'Remote Position', value: false },
        { name: 'Experience Range', value: ['3.0 to 5.0 Years'] },
      ],
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Hyderabad, Telangana, India' }],
    },
    {
      id: 6542907003,
      title: 'Account Executive - Enterprise Net-New',
      location: { name: 'Houston, Texas, United States' },
      absolute_url: 'https://www.highradius.com/about/careers-list/?gh_jid=6542907003',
      requisition_id: '20250110',
      company_name: 'HighRadius',
      updated_at: '2026-06-23T08:16:55-04:00',
      first_published: '2026-06-08T05:28:06-04:00',
      content: '&lt;p&gt;US-only role.&lt;/p&gt;',
      metadata: [
        { name: 'Remote Position', value: false },
      ],
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'Houston, Texas, United States' }],
    },
  ],
}

const loadHighRadiusModule = async () => {
  try {
    return await import('../../scraper/highradius/script.js')
  } catch {
    assert.fail('Expected HighRadius scraper module at ../../scraper/highradius/script.js')
  }
}

test('HighRadius pins the verified first-party careers page and Greenhouse handoff constants', async () => {
  const highRadius = await loadHighRadiusModule()

  assert.equal(highRadius.SOURCE, 'highradius')
  assert.equal(highRadius.COMPANY_NAME, 'HighRadius')
  assert.equal(highRadius.OFFICIAL_BRAND_NAME, 'HighRadius Corporation')
  assert.equal(highRadius.CAREERS_URL, 'https://www.highradius.com/about/career/')
  assert.equal(highRadius.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/highradius')
  assert.equal(
    highRadius.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/highradius/jobs?content=true',
  )
  assert.equal(highRadius.hasOfficialCareersPageSignal(buildCareersPageHtml()), true)
  assert.deepEqual(
    highRadius.extractFirstPartyJobIdsFromCareersPage(buildCareersPageHtml()),
    ['6542907003', '7611164003', '7701514003'],
  )
  assert.equal(
    highRadius.normalizeHighRadiusJobUrl(
      'https://www.highradius.com/about/careers-list/?gh_jid=7701514003&utm_source=homepage',
      7701514003,
    ),
    'https://www.highradius.com/about/careers-list/?gh_jid=7701514003',
  )
})

test('HighRadius extracts only India jobs from the verified Greenhouse payload and keeps the first-party detail routes', async () => {
  const highRadius = await loadHighRadiusModule()

  const jobs = highRadius.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    allowedJobIds: new Set(['7611164003', '7701514003']),
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs, [
    {
      title: 'Agent Developer Test III',
      company: 'HighRadius',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      link: 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
      applyUrl: 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
      sourceUrl: 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
      source: 'highradius',
      jobId: '7611164003',
      requisitionId: '20260205',
      department: 'Product & Engineering',
      employmentType: null,
      experienceRequired: '5.1 to 7.0 Years',
      jobDescription: 'Design and implement robust test automation frameworks.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-23T08:16:55-04:00',
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Analyst - Strategic Alliances',
      company: 'HighRadius',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      link: 'https://www.highradius.com/about/careers-list/?gh_jid=7701514003',
      applyUrl: 'https://www.highradius.com/about/careers-list/?gh_jid=7701514003',
      sourceUrl: 'https://www.highradius.com/about/careers-list/?gh_jid=7701514003',
      source: 'highradius',
      jobId: '7701514003',
      requisitionId: '20260409',
      department: 'Sales',
      employmentType: null,
      experienceRequired: '3.0 to 5.0 Years',
      jobDescription: 'Drive partnership strategy with research and stakeholder management.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-23T08:16:55-04:00',
      remoteStatus: 'On-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('HighRadius run validates the first-party careers page before fetching the public Greenhouse API', async () => {
  const highRadius = await loadHighRadiusModule()
  const requested = []

  const jobs = await highRadius.createHighRadiusScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === highRadius.CAREERS_URL) return buildCareersPageHtml()
      throw new Error(`Unexpected HighRadius fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: highRadius.CAREERS_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/highradius/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'highradius')
  assert.equal(jobs[0].company, 'HighRadius')
  assert.equal(jobs[0].link, 'https://www.highradius.com/about/careers-list/?gh_jid=7611164003')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('HighRadius fails closed when the first-party careers page or Greenhouse company identity drifts', async () => {
  const highRadius = await loadHighRadiusModule()

  await assert.rejects(
    highRadius.createHighRadiusScraper().run({
      fetchText: async () => buildCareersPageHtml().replace('Analyst - Strategic Alliances', 'Missing job'),
      fetchJson: async () => greenhousePayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    highRadius.createHighRadiusScraper().run({
      fetchText: async () => buildCareersPageHtml(),
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
