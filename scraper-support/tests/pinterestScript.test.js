import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore career opportunities at Pinterest | Pinterest Careers</title>
  </head>
  <body>
    <main>
      <h1>Explore career opportunities at Pinterest</h1>
      <h2>Filter jobs</h2>
      <p>Displaying 1 to 20 of 191 matching jobs</p>
      <button>Protecting our job seekers</button>
      <button>Our Philosophy on AI in Hiring</button>
    </main>
  </body>
</html>
`

const CLOUDFLARE_INTERSTITIAL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <h1>Just a moment...</h1>
    <p>Enable JavaScript and cookies to continue</p>
  </body>
</html>
`

const GREENHOUSE_PAYLOAD_WITH_INDIA = {
  jobs: [
    {
      id: 9000001,
      title: 'Software Engineer, Ads Platform',
      absolute_url: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000001',
      updated_at: '2026-07-10T09:00:00-04:00',
      first_published: '2026-07-10T09:00:00-04:00',
      company_name: 'Pinterest',
      location: { name: 'Bengaluru, India' },
      departments: [{ name: 'Engineering' }],
      content: '<p>Build Ads Platform systems for Pinterest in Bengaluru.</p>',
    },
    {
      id: 9000002,
      title: 'Client Partner',
      absolute_url: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000002',
      updated_at: '2026-07-11T12:30:00-04:00',
      first_published: '2026-07-11T12:30:00-04:00',
      company_name: 'Pinterest',
      location: { name: 'Remote, IN' },
      departments: [{ name: 'Sales' }],
      content: '<p>Support Pinterest advertisers remotely from India.</p>',
    },
    {
      id: 9000003,
      title: 'Chief of Staff, Marketing',
      absolute_url: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000003',
      updated_at: '2026-07-15T16:57:45-04:00',
      first_published: '2026-07-15T16:57:45-04:00',
      company_name: 'Pinterest',
      location: { name: 'Seattle, WA, US; Remote, US' },
      departments: [{ name: 'Marketing, Communications, and Creative' }],
      content: '<p>Support marketing leadership from Seattle.</p>',
    },
  ],
}

const LIVE_BOARD_PAYLOAD_WITHOUT_INDIA = {
  jobs: [
    {
      id: 8010505,
      title: 'Agency Lead',
      absolute_url: 'https://www.pinterestcareers.com/jobs/?gh_jid=8010505',
      updated_at: '2026-06-17T20:06:36-04:00',
      first_published: '2026-06-17T20:06:36-04:00',
      company_name: 'Pinterest',
      location: { name: 'Tokyo, JP' },
      departments: [{ name: 'Sales' }],
      content: '<p>Drive agency relationships in Tokyo.</p>',
    },
    {
      id: 8052638,
      title: 'Chief of Staff, Marketing',
      absolute_url: 'https://www.pinterestcareers.com/jobs/?gh_jid=8052638',
      updated_at: '2026-07-15T16:57:45-04:00',
      first_published: '2026-07-15T16:57:45-04:00',
      company_name: 'Pinterest',
      location: { name: 'Seattle, WA, US; Remote, US' },
      departments: [{ name: 'Marketing, Communications, and Creative' }],
      content: '<p>Support marketing leadership from Seattle.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/pinterest/script.js')
  } catch {
    assert.fail('Expected Pinterest scraper module at ../../scraper/pinterest/script.js')
  }
}

test('Pinterest pins the verified first-party careers domain and Greenhouse API contract', async () => {
  const pinterest = await loadModule()

  assert.equal(pinterest.CAREERS_PAGE_URL, 'https://www.pinterestcareers.com/jobs/')
  assert.equal(
    pinterest.GREENHOUSE_JOBS_API_URL,
    'https://boards-api.greenhouse.io/v1/boards/pinterest/jobs?content=true',
  )
  assert.equal(
    pinterest.OFFICIAL_JOB_URL_PREFIX,
    'https://www.pinterestcareers.com/jobs/?gh_jid=',
  )
  assert.equal(pinterest.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(pinterest.isCloudflareInterstitial(CLOUDFLARE_INTERSTITIAL_HTML), true)
})

test('Pinterest extracts only India jobs from the verified Greenhouse payload shape', async () => {
  const pinterest = await loadModule()
  const jobs = pinterest.extractIndiaJobsFromGreenhousePayload(
    GREENHOUSE_PAYLOAD_WITH_INDIA,
    { scrapedAt: FIXED_SCRAPED_AT },
  )

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer, Ads Platform',
      company: 'Pinterest',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '9000001',
      requisitionId: '9000001',
      sourceUrl: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000001',
      applyUrl: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000001',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-10T09:00:00-04:00',
      closingDate: null,
      jobDescription: '<p>Build Ads Platform systems for Pinterest in Bengaluru.</p>',
      remoteStatus: null,
      source: 'pinterest',
      link: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Client Partner',
      company: 'Pinterest',
      department: 'Sales',
      location: 'Remote, IN',
      city: null,
      country: 'India',
      jobId: '9000002',
      requisitionId: '9000002',
      sourceUrl: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000002',
      applyUrl: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000002',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-11T12:30:00-04:00',
      closingDate: null,
      jobDescription: '<p>Support Pinterest advertisers remotely from India.</p>',
      remoteStatus: 'Remote',
      source: 'pinterest',
      link: 'https://www.pinterestcareers.com/jobs/?gh_jid=9000002',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Pinterest run tolerates the live Cloudflare interstitial and returns an honest zero-job India slice when the public payload has no India roles', async () => {
  const pinterest = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await pinterest.createPinterestScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      return CLOUDFLARE_INTERSTITIAL_HTML
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return LIVE_BOARD_PAYLOAD_WITHOUT_INDIA
    },
  })

  assert.deepEqual(requestedTextUrls, [pinterest.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJsonUrls, [pinterest.GREENHOUSE_JOBS_API_URL])
  assert.deepEqual(jobs, [])
})

test('Pinterest fails closed when the official careers page or Greenhouse payload drifts away from the verified surface', async () => {
  const pinterest = await loadModule()

  await assert.rejects(
    pinterest.createPinterestScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => LIVE_BOARD_PAYLOAD_WITHOUT_INDIA,
    }),
    /verified official pinterest careers page/i,
  )

  await assert.rejects(
    pinterest.createPinterestScraper().run({
      fetchText: async () => CLOUDFLARE_INTERSTITIAL_HTML,
      fetchJson: async () => ({
        jobs: [
          {
            id: 1,
            title: 'Broken Job',
            absolute_url: 'https://jobs.example.com/1',
            company_name: 'Pinterest',
            location: { name: 'Bengaluru, India' },
          },
        ],
      }),
    }),
    /verified pinterest greenhouse payload/i,
  )
})
