import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sauce Labs Careers &amp; Opportunities</title>
  </head>
  <body>
    <main>
      <h1>CAREERS</h1>
      <p>Join the movement</p>
      <button>See openings</button>
      <p>National Capital Region, New Delhi</p>
      <h2>Current positions at Sauce Labs</h2>
      <button>17 open roles</button>
      <button>Departments</button>
      <button>Locations</button>
    </main>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD_WITH_INDIA = {
  jobs: [
    {
      id: 7096532,
      title: 'AI Architect',
      absolute_url: 'https://job-boards.greenhouse.io/saucelabs/jobs/7096532',
      updated_at: '2026-06-25T11:10:37-04:00',
      first_published: '2025-07-23T10:23:20-04:00',
      company_name: 'Sauce Labs Inc.',
      location: { name: 'Gurugram, India' },
      departments: [{ name: '3210:Development' }],
      content: '<p>Architect the next generation of AI-powered quality workflows.</p>',
      offices: [
        { location: 'Berlin, Berlin, Germany' },
        { location: 'Gurugram, Haryana, India' },
      ],
    },
    {
      id: 7899103,
      title: 'Graphic Designer',
      absolute_url: 'https://job-boards.greenhouse.io/saucelabs/jobs/7899103',
      updated_at: '2026-05-29T09:06:06-04:00',
      first_published: '2026-05-07T03:35:13-04:00',
      company_name: 'Sauce Labs Inc.',
      location: { name: 'Gurugram, Haryana' },
      departments: [{ name: '2410:Enterprise Marketing' }],
      content: '<p>Create high-quality creative assets across digital and campaign channels.</p>',
      offices: [
        { location: 'Gurugram, Haryana, India' },
      ],
    },
    {
      id: 7551123,
      title: 'Inside Sales Representative',
      absolute_url: 'https://job-boards.greenhouse.io/saucelabs/jobs/7551123',
      updated_at: '2026-06-24T12:00:00-04:00',
      first_published: '2026-04-20T09:00:00-04:00',
      company_name: 'Sauce Labs Inc.',
      location: { name: 'London, UK' },
      departments: [{ name: '2210:Sales' }],
      content: '<p>Non-India role.</p>',
      offices: [
        { location: 'London, United Kingdom' },
      ],
    },
  ],
}

const GREENHOUSE_PAYLOAD_WITHOUT_INDIA = {
  jobs: [
    {
      id: 7551123,
      title: 'Inside Sales Representative',
      absolute_url: 'https://job-boards.greenhouse.io/saucelabs/jobs/7551123',
      updated_at: '2026-06-24T12:00:00-04:00',
      first_published: '2026-04-20T09:00:00-04:00',
      company_name: 'Sauce Labs',
      location: { name: 'London, UK' },
      departments: [{ name: '2210:Sales' }],
      content: '<p>Non-India role.</p>',
      offices: [
        { location: 'London, United Kingdom' },
      ],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/saucelabs/script.js')
  } catch {
    assert.fail('Expected Sauce Labs scraper module at ../../scraper/saucelabs/script.js')
  }
}

test('Sauce Labs pins the verified first-party careers page, Greenhouse API, and same-domain detail URL pattern', async () => {
  const saucelabs = await loadModule()

  assert.equal(saucelabs.SOURCE, 'saucelabs')
  assert.equal(saucelabs.COMPANY, 'Sauce Labs')
  assert.equal(saucelabs.VERIFIED_ON, '2026-07-17')
  assert.equal(saucelabs.CAREERS_PAGE_URL, 'https://saucelabs.com/careers')
  assert.equal(saucelabs.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/saucelabs')
  assert.equal(
    saucelabs.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/saucelabs/jobs?content=true',
  )
  assert.equal(saucelabs.FIRST_PARTY_DETAIL_URL_BASE, 'https://saucelabs.com/company/careers/')
  assert.equal(
    saucelabs.buildFirstPartyDetailUrl('7096532'),
    'https://saucelabs.com/company/careers/7096532',
  )
  assert.equal(saucelabs.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('Sauce Labs extracts only India jobs from the verified Greenhouse payload and prefers first-party detail URLs', async () => {
  const saucelabs = await loadModule()
  const jobs = saucelabs.extractIndiaJobsFromGreenhousePayload(
    GREENHOUSE_PAYLOAD_WITH_INDIA,
    { scrapedAt: FIXED_SCRAPED_AT },
  )

  assert.deepEqual(jobs, [
    {
      title: 'AI Architect',
      company: 'Sauce Labs',
      department: 'Development',
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '7096532',
      requisitionId: '7096532',
      sourceUrl: 'https://saucelabs.com/company/careers/7096532',
      applyUrl: 'https://saucelabs.com/company/careers/7096532',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-23T10:23:20-04:00',
      closingDate: null,
      jobDescription: '<p>Architect the next generation of AI-powered quality workflows.</p>',
      remoteStatus: 'On-site',
      source: 'saucelabs',
      link: 'https://saucelabs.com/company/careers/7096532',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Graphic Designer',
      company: 'Sauce Labs',
      department: 'Enterprise Marketing',
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '7899103',
      requisitionId: '7899103',
      sourceUrl: 'https://saucelabs.com/company/careers/7899103',
      applyUrl: 'https://saucelabs.com/company/careers/7899103',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-05-07T03:35:13-04:00',
      closingDate: null,
      jobDescription: '<p>Create high-quality creative assets across digital and campaign channels.</p>',
      remoteStatus: 'On-site',
      source: 'saucelabs',
      link: 'https://saucelabs.com/company/careers/7899103',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Sauce Labs run reads the verified Greenhouse payload over HTTP', async () => {
  const saucelabs = await loadModule()
  const requestedJsonUrls = []

  const jobs = await saucelabs.createSauceLabsScraper({
    now: () => FIXED_SCRAPED_AT,
    maxJobs: 1,
  }).run({
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return GREENHOUSE_PAYLOAD_WITH_INDIA
    },
  })

  assert.deepEqual(requestedJsonUrls, [
    'https://boards-api.greenhouse.io/v1/boards/saucelabs/jobs?content=true',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'AI Architect',
      company: 'Sauce Labs',
      department: 'Development',
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      jobId: '7096532',
      requisitionId: '7096532',
      sourceUrl: 'https://saucelabs.com/company/careers/7096532',
      applyUrl: 'https://saucelabs.com/company/careers/7096532',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2025-07-23T10:23:20-04:00',
      closingDate: null,
      jobDescription: '<p>Architect the next generation of AI-powered quality workflows.</p>',
      remoteStatus: 'On-site',
      source: 'saucelabs',
      link: 'https://saucelabs.com/company/careers/7096532',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://saucelabs.com/careers',
      companyDomain: 'saucelabs.com',
      atsPlatform: 'greenhouse',
    },
  ])
})

test('Sauce Labs run returns an honest empty slice when the verified live board has no India roles', async () => {
  const saucelabs = await loadModule()

  const jobs = await saucelabs.createSauceLabsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async () => GREENHOUSE_PAYLOAD_WITHOUT_INDIA,
  })

  assert.deepEqual(jobs, [])
})

test('Sauce Labs fails closed when the Greenhouse payload drifts away from the verified contract', async () => {
  const saucelabs = await loadModule()

  await assert.rejects(
    saucelabs.createSauceLabsScraper().run({
      fetchJson: async () => ({
        jobs: [
          {
            id: 1,
            title: 'Broken Job',
            absolute_url: 'https://example.com/jobs/1',
            location: { name: 'India' },
          },
        ],
      }),
    }),
    /verified Sauce Labs greenhouse payload/i,
  )
})
