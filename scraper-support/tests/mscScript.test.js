import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work With Us - Careers &amp; Vacancies | MSC</title>
  </head>
  <body>
    <h1>CAREERS AT MSC</h1>
    <p>A WORLD OF OPPORTUNITIES</p>
    <h2>Explore our Vacant Positions</h2>
    <div
      class="msc-careers-vacancies"
      data-api-url-job-locations="/api/feature/Career/GetJobLocationsList"
      data-api-url="/api/feature/Career/GetJobVacanciesJobLocationId"
    ></div>
  </body>
</html>
`

const ACCESS_DENIED_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Access Denied</title>
  </head>
  <body>
    <h1>Access Denied</h1>
    <p>You don't have permission to access "http://www.msc.com/en/careers" on this server.</p>
  </body>
</html>
`

const JOB_LOCATIONS_RESPONSE = [
  { Id: 'albania-id', Name: 'Albania' },
  { Id: 'india-id', Name: 'India' },
]

const EMPTY_INDIA_RESPONSE = {
  ID: 'india-id',
  JobLocationName: 'India',
  Message: 'Take your career to the next level with MSC. Unfortunately, we do not have any vacancies published in this country right now. We kindly ask you to come back later or explore if there are interesting positions for you in other MSC offices.',
  LinkedInUrl: '',
  LocalPlatformUrl: [],
  PulseUrl: '',
  Jobs: [],
}

const INLINE_INDIA_RESPONSE = {
  ID: 'india-id',
  JobLocationName: 'India',
  Message: 'Take your career to the next level with MSC. Explore our latest job opportunities',
  LinkedInUrl: '',
  LocalPlatformUrl: [],
  PulseUrl: '',
  Jobs: [
    {
      ID: '{IND-1}',
      Description: 'Senior Documentation Executive',
      Category: 'Associate',
      Summary: `
        <p>Support import and export documentation workflows.</p>
        <ul>
          <li>Customer communication</li>
          <li>Documentation accuracy</li>
        </ul>
      `,
      Office: 'Mumbai',
      LinkedInLink: '',
      PulseLink: '',
      LocalPlatformLink: 'https://jobs.example.com/apply/ind-1',
      Country: 'India',
    },
  ],
}

const EXTERNAL_ONLY_INDIA_RESPONSE = {
  ID: 'india-id',
  JobLocationName: 'India',
  Message: 'Take your career to the next level with MSC. Explore our latest job opportunities',
  LinkedInUrl: 'https://www.linkedin.com/company/msc/jobs/',
  LocalPlatformUrl: [],
  PulseUrl: '',
  Jobs: [],
}

const loadMscModule = async () => {
  try {
    return await import('../../scraper/msc/script.js')
  } catch {
    assert.fail('Expected MSC scraper module at ../../scraper/msc/script.js')
  }
}

test('MSC constants and surface validators stay pinned to the August 3, 2026 careers shell and India APIs', async () => {
  const msc = await loadMscModule()

  assert.equal(msc.SOURCE, 'msc')
  assert.equal(msc.COMPANY, 'MSC')
  assert.equal(msc.OFFICIAL_BRAND_NAME, 'MSC Mediterranean Shipping Company')
  assert.equal(msc.HOMEPAGE_URL, 'https://www.msc.com/en')
  assert.equal(msc.CAREERS_URL, 'https://www.msc.com/en/careers')
  assert.equal(msc.COMPANY_DOMAIN, 'msc.com')
  assert.equal(msc.JOB_LOCATIONS_API_URL, 'https://www.msc.com/api/feature/Career/GetJobLocationsList')
  assert.equal(msc.VACANCIES_API_URL, 'https://www.msc.com/api/feature/Career/GetJobVacanciesJobLocationId')
  assert.equal(msc.TARGET_JOB_LOCATION_NAME, 'India')
  assert.equal(msc.VERIFIED_ON, '2026-09-13')
  assert.equal(msc.hasVerifiedMscCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(msc.hasVerifiedMscAccessDeniedSignal(ACCESS_DENIED_HTML), true)
  assert.equal(msc.hasInlineMscJobs(EMPTY_INDIA_RESPONSE), false)
  assert.equal(msc.hasInlineMscJobs(INLINE_INDIA_RESPONSE), true)
  assert.equal(msc.hasPublicMscJobSignals(EMPTY_INDIA_RESPONSE), false)
  assert.equal(msc.hasPublicMscJobSignals(INLINE_INDIA_RESPONSE), true)
  assert.equal(msc.isVerifiedEmptyIndiaResponse(EMPTY_INDIA_RESPONSE), true)
})

test('extractMscJobs converts inline India careers API jobs into the shared runner schema', async () => {
  const msc = await loadMscModule()

  const jobs = msc.extractMscJobs(INLINE_INDIA_RESPONSE, {
    now: () => '2026-09-13T10:11:12.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Documentation Executive',
    company: 'MSC',
    department: 'Associate',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'IND-1',
    requisitionId: 'IND-1',
    sourceUrl: msc.buildCareerUrl({ jobLocationName: 'India', jobId: '{IND-1}' }),
    applyUrl: 'https://jobs.example.com/apply/ind-1',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Customer communication', 'Documentation accuracy'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Support import and export documentation workflows. Customer communication Documentation accuracy',
    remoteStatus: null,
    source: 'msc',
    link: 'https://jobs.example.com/apply/ind-1',
    scrapedAt: '2026-09-13T10:11:12.000Z',
  })
})

test('MSC returns [] when the verified careers shell and India vacancies API still show the official empty-state message', async () => {
  const msc = await loadMscModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await msc.createMscScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === msc.CAREERS_URL) return VERIFIED_CAREERS_HTML
      throw new Error(`Unexpected MSC text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === msc.JOB_LOCATIONS_API_URL) return JOB_LOCATIONS_RESPONSE
      if (url === msc.buildVacanciesUrl('india-id')) return EMPTY_INDIA_RESPONSE
      throw new Error(`Unexpected MSC JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [msc.CAREERS_URL])
  assert.deepEqual(requestedJsonUrls, [
    msc.JOB_LOCATIONS_API_URL,
    msc.buildVacanciesUrl('india-id'),
  ])
  assert.deepEqual(jobs, [])
})

test('MSC extracts inline India jobs when the vacancies API returns public Jobs[] for the India location', async () => {
  const msc = await loadMscModule()

  const jobs = await msc.createMscScraper().run({
    fetchText: async () => VERIFIED_CAREERS_HTML,
    fetchJson: async (url) => {
      if (url === msc.JOB_LOCATIONS_API_URL) return JOB_LOCATIONS_RESPONSE
      if (url === msc.buildVacanciesUrl('india-id')) return INLINE_INDIA_RESPONSE
      throw new Error(`Unexpected MSC JSON URL: ${url}`)
    },
    now: () => '2026-09-13T10:11:12.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Documentation Executive')
  assert.equal(jobs[0].city, 'Mumbai')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'msc')
  assert.equal(jobs[0].link, 'https://jobs.example.com/apply/ind-1')
})

test('MSC rejects the first-party access-denied gate as an unavailable snapshot', async () => {
  const msc = await loadMscModule()

  await assert.rejects(msc.createMscScraper().run({
    fetchText: async () => ACCESS_DENIED_HTML,
    fetchJson: async () => {
      throw new Error('MSC should not call the careers APIs when access is denied')
    },
  }), /access denied|unavailable/i)
})

test('MSC fails closed when the India vacancies API only exposes external public job links without inline Jobs[] data', async () => {
  const msc = await loadMscModule()

  await assert.rejects(
    msc.createMscScraper().run({
      fetchText: async () => VERIFIED_CAREERS_HTML,
      fetchJson: async (url) => {
        if (url === msc.JOB_LOCATIONS_API_URL) return JOB_LOCATIONS_RESPONSE
        if (url === msc.buildVacanciesUrl('india-id')) return EXTERNAL_ONLY_INDIA_RESPONSE
        throw new Error(`Unexpected MSC JSON URL: ${url}`)
      },
    }),
    /public jobs outside the verified inline empty-state contract/i,
  )
})
