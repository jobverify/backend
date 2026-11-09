import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <p>Trusted by 30 Lakh+ Indians</p>
    <h1><span>Join us </span><span>as we improve</span><span>financial wellness </span><span>for millions</span><span>●</span></h1>
    <a href=https://jupiter.keka.com/careers target="_blank">View all openings</a>
    <p>Explore open roles</p>
  </body>
</html>
`

const CAREER_PORTAL_INFO = {
  name: 'Jupiter Money',
  shortName: 'Jupiter Money',
  careersPortalDomain: 'jupiter.keka.com',
  jobListingSetting: {
    filters: ['department', 'location'],
    jobFields: ['location', 'experience', 'jobType'],
  },
}

const ACTIVE_JOBS_PAYLOAD = [
  {
    id: 134831,
    title: 'Devops Engineer - SDE 2',
    description: '<div>Build and maintain highly scalable AWS infrastructure.</div>',
    departmentIdentifier: '387a3926-bffc-457f-b061-cbfbf2ecb155',
    departmentName: 'Engineering',
    jobLocations: [
      {
        id: 31395,
        name: 'Europa Bangalore',
        city: 'Bengaluru',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '3-5',
    publishedOn: '2026-07-15T07:26:49.647Z',
    skillNames: [],
  },
  {
    id: 134239,
    title: 'Hr Operations Lead',
    description: '<div>Own and drive the end-to-end employee lifecycle at Jupiter Money.</div>',
    departmentIdentifier: '44e902b4-dc9c-4c66-bb73-94b8ede2d7a4',
    departmentName: 'Human Resource',
    jobLocations: [
      {
        id: 40000,
        name: '',
        city: 'Bengaluru',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '5-8',
    publishedOn: '2026-07-08T12:02:46.923Z',
    skillNames: ['HR Operations', 'Compliance'],
  },
  {
    id: 200001,
    title: 'US Only Growth Manager',
    description: '<div>Should be filtered out.</div>',
    departmentIdentifier: 'marketing',
    departmentName: 'Marketing',
    jobLocations: [
      {
        id: 50000,
        name: 'San Francisco',
        city: 'San Francisco',
        state: 'CA',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '4-6',
    publishedOn: '2026-07-10T00:00:00.000Z',
    skillNames: ['Growth'],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/jupiter/script.js')
  } catch {
    assert.fail('Expected Jupiter scraper module at ../../scraper/jupiter/script.js')
  }
}

test('Jupiter helpers stay pinned to the verified first-party careers page and Keka endpoints', async () => {
  const jupiter = await loadModule()

  assert.equal(jupiter.SOURCE, 'jupiter')
  assert.equal(jupiter.COMPANY, 'Jupiter')
  assert.equal(jupiter.OFFICIAL_BRAND_NAME, 'Jupiter Money')
  assert.equal(jupiter.CAREERS_PAGE_URL, 'https://jupiter.money/careers/')
  assert.equal(jupiter.JOBS_BOARD_URL, 'https://jupiter.keka.com/careers')
  assert.equal(
    jupiter.CAREER_PORTAL_INFO_URL,
    'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    jupiter.ACTIVE_JOBS_URL,
    'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5',
  )
  assert.equal(jupiter.EXPECTED_IDENTIFIER, 'b5279857-cf81-4dde-a215-fc48957ee2b5')
  assert.equal(jupiter.extractKekaBoardUrl(CAREERS_PAGE_HTML), jupiter.JOBS_BOARD_URL)
  assert.equal(jupiter.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.equal(jupiter.hasCareerPortalInfoSignal(CAREER_PORTAL_INFO), true)
})

test('Jupiter extracts India jobs from the public Keka active-jobs payload', async () => {
  const jupiter = await loadModule()

  assert.deepEqual(
    jupiter.extractIndiaJobsFromActivePayload(ACTIVE_JOBS_PAYLOAD),
    [
      {
        title: 'Devops Engineer - SDE 2',
        company: 'Jupiter',
        department: 'Engineering',
        location: 'Europa Bangalore, Bengaluru, KA, India',
        city: 'Bengaluru',
        state: 'KA',
        country: 'India',
        jobId: '134831',
        requisitionId: '134831',
        sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134831',
        applyUrl: 'https://jupiter.keka.com/careers/applyjob/134831',
        employmentType: 'Full-Time',
        experienceRequired: '3-5',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2026-07-15',
        closingDate: null,
        jobDescription: 'Build and maintain highly scalable AWS infrastructure.',
        remoteStatus: null,
      },
      {
        title: 'Hr Operations Lead',
        company: 'Jupiter',
        department: 'Human Resource',
        location: 'Bengaluru, KA, India',
        city: 'Bengaluru',
        state: 'KA',
        country: 'India',
        jobId: '134239',
        requisitionId: '134239',
        sourceUrl: 'https://jupiter.keka.com/careers/jobdetails/134239',
        applyUrl: 'https://jupiter.keka.com/careers/applyjob/134239',
        employmentType: 'Full-Time',
        experienceRequired: '5-8',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['HR Operations', 'Compliance'],
        postingDate: '2026-07-08',
        closingDate: null,
        jobDescription: 'Own and drive the end-to-end employee lifecycle at Jupiter Money.',
        remoteStatus: null,
      },
    ],
  )
})

test('Jupiter run verifies the trusted first-party careers surface before returning India Keka jobs', async () => {
  const jupiter = await loadModule()
  const requestedText = []
  const requestedJson = []

  const jobs = await jupiter.createJupiterScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedText.push(url)
      if (url === jupiter.CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
      throw new Error(`Unexpected Jupiter text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === jupiter.CAREER_PORTAL_INFO_URL) return CAREER_PORTAL_INFO
      if (url === jupiter.ACTIVE_JOBS_URL) return ACTIVE_JOBS_PAYLOAD
      throw new Error(`Unexpected Jupiter JSON URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  })

  assert.deepEqual(requestedText, [jupiter.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [
    jupiter.CAREER_PORTAL_INFO_URL,
    jupiter.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'jupiter')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
  assert.equal(jobs[0].title, 'Devops Engineer - SDE 2')
})

test('Jupiter can recover with browser-backed careers and Keka payloads when direct requests time out', async () => {
  const jupiter = await loadModule()
  const browserTextUrls = []
  const browserJsonUrls = []

  const jobs = await jupiter.createJupiterScraper({
    maxJobs: 1,
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: jupiter.money:443, timeout: 10000ms)')
    },
    fetchJson: async () => {
      throw new Error('fetch failed | Connect Timeout Error (attempted address: jupiter.keka.com:443, timeout: 10000ms)')
    },
    fetchBrowserText: async (url) => {
      browserTextUrls.push(url)
      if (url === jupiter.CAREERS_PAGE_URL) return CAREERS_PAGE_HTML
      throw new Error(`Unexpected browser text URL: ${url}`)
    },
    fetchBrowserJson: async (url) => {
      browserJsonUrls.push(url)
      if (url === jupiter.CAREER_PORTAL_INFO_URL) return CAREER_PORTAL_INFO
      if (url === jupiter.ACTIVE_JOBS_URL) return ACTIVE_JOBS_PAYLOAD
      throw new Error(`Unexpected browser JSON URL: ${url}`)
    },
  })

  assert.deepEqual(browserTextUrls, [jupiter.CAREERS_PAGE_URL])
  assert.deepEqual(browserJsonUrls, [
    jupiter.CAREER_PORTAL_INFO_URL,
    jupiter.ACTIVE_JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'jupiter')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T00:00:00.000Z')
})

test('Jupiter fails closed when the verified careers handoff no longer points to the official Keka board', async () => {
  const jupiter = await loadModule()

  await assert.rejects(
    jupiter.createJupiterScraper().run({
      fetchText: async () => '<html><body><h1>Join us</h1><a href="https://example.com/jobs">View all openings</a></body></html>',
      fetchBrowserText: async () => '<html><body><h1>Join us</h1><a href="https://example.com/jobs">View all openings</a></body></html>',
      fetchJson: async () => ACTIVE_JOBS_PAYLOAD,
    }),
    /verified first-party careers page/i,
  )
})
