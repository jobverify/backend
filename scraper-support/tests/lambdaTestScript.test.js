import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T12:00:00.000Z'

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at TestMu AI (Formerly LambdaTest) | A Cross Browser Testing Tool</title>
    </head>
    <body>
      <main>
        <h1>Open Positions</h1>
        <a href="https://lambdatest.kekahire.com/jobdetails/134349">Apply Here</a>
      </main>
    </body>
  </html>
`

const departmentsPayload = [
  { departmentIdentifier: 'app-support', departmentName: 'Application Support' },
  { departmentIdentifier: 'engineering', departmentName: 'Engineering' },
  { departmentIdentifier: 'sales', departmentName: 'Sales' },
]

const liveDepartmentsPayload = [
  { identifier: 'application-support', name: 'Application Support' },
  { identifier: 'engineering', name: 'Engineering' },
  { identifier: 'sales', name: 'Sales' },
]

const activeJobsPayload = [
  {
    id: 134349,
    title: 'Solutions Engineer',
    description: '<div>Work with enterprise teams to unblock browser testing adoption.</div>',
    departmentIdentifier: 'app-support',
    departmentName: 'Application Support',
    excerpt: 'Work with enterprise teams to unblock browser testing adoption.',
    jobLocations: [
      {
        city: 'Bangalore',
        state: 'KA',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '4-8 years',
    jobNumber: 'LT307',
    salaryRange: null,
    salaryRangeFormat: null,
    publishedOn: '2026-07-09T11:50:47.557Z',
    skillNames: ['Selenium', 'Playwright', 'Customer Communication'],
  },
  {
    id: 133031,
    title: 'Backend & Platform Engineer',
    description: '<p>Build scalable backend systems for distributed testing workloads.</p>',
    departmentIdentifier: 'platform',
    departmentName: 'Platform Team- DevOps & Data Center',
    excerpt: 'Build scalable backend systems for distributed testing workloads.',
    jobLocations: [
      {
        city: 'Noida',
        state: 'UP',
        countryCode: 'IN',
        countryName: 'India',
      },
    ],
    jobType: 2,
    experience: '5-9 years',
    jobNumber: 'LT302',
    salaryRange: null,
    salaryRangeFormat: null,
    publishedOn: '2026-06-29T11:35:35.957Z',
    skillNames: ['Node.js', 'Kubernetes'],
  },
  {
    id: 130000,
    title: 'Enterprise Account Executive',
    description: '<p>Sell into global enterprise accounts.</p>',
    departmentIdentifier: 'sales',
    departmentName: 'Sales',
    excerpt: 'Sell into global enterprise accounts.',
    jobLocations: [
      {
        city: 'Remote',
        state: 'NY',
        countryCode: 'US',
        countryName: 'United States',
      },
    ],
    jobType: 2,
    experience: '8+ years',
    jobNumber: 'LT280',
    salaryRange: null,
    salaryRangeFormat: null,
    publishedOn: '2026-05-10T10:00:00.000Z',
    skillNames: ['Enterprise Sales'],
  },
]

const loadLambdaTestModule = async () => {
  try {
    return await import('../../scraper/lambdatest/script.js')
  } catch {
    assert.fail('Expected LambdaTest scraper module at ../../scraper/lambdatest/script.js')
  }
}

test('LambdaTest pins the verified first-party careers shell and JSON API helper contracts', async () => {
  const lambdaTest = await loadLambdaTestModule()

  assert.equal(lambdaTest.SOURCE, 'lambdatest')
  assert.equal(lambdaTest.COMPANY_NAME, 'LambdaTest')
  assert.equal(lambdaTest.OFFICIAL_BRAND_NAME, 'TestMu AI (Formerly LambdaTest)')
  assert.equal(lambdaTest.HOMEPAGE_URL, 'https://www.lambdatest.com/')
  assert.equal(lambdaTest.LEGACY_CAREERS_PAGE_URL, 'https://www.lambdatest.com/careers')
  assert.equal(lambdaTest.OFFICIAL_CAREERS_URL, 'https://www.testmuai.com/career/')
  assert.equal(
    lambdaTest.ACTIVE_JOBS_API_URL,
    'https://test-backend.lambdatest.com/api/careers-page/active-jobs',
  )
  assert.equal(
    lambdaTest.DEPARTMENTS_API_URL,
    'https://test-backend.lambdatest.com/api/careers-page/org-departments',
  )
  assert.equal(lambdaTest.VERIFIED_ON, '2026-10-03')
  assert.equal(
    lambdaTest.buildJobDetailUrl({ jobId: '134349' }),
    'https://lambdatest.kekahire.com/jobdetails/134349',
  )
  assert.equal(lambdaTest.hasOfficialLambdaTestCareersSignals(officialCareersHtml), true)
  assert.equal(lambdaTest.hasOfficialLambdaTestCareersSignals('<html><head><title>Find your role in 4 minutes, consult with our Advisor &amp; get hired!</title></head><body><h1>Careers at TestMu AI, Formerly LambdaTest.</h1><h2>Open Positions</h2><a>Apply Here</a></body></html>'), true)
  assert.equal(
    lambdaTest.hasOfficialLambdaTestCareersSignals('<html><head><title>Careers</title></head><body><h1>Jobs</h1></body></html>'),
    false,
  )
  assert.equal(lambdaTest.hasExpectedDepartmentPayload(departmentsPayload), true)
  assert.equal(lambdaTest.hasExpectedDepartmentPayload(liveDepartmentsPayload), true)
  assert.equal(lambdaTest.hasExpectedDepartmentPayload([{ name: 'Application Support Engineer' }, { name: 'Engineering' }, { name: 'Sales' }]), true)
  assert.equal(lambdaTest.hasExpectedDepartmentPayload([{ departmentName: 'Support' }]), false)
})

test('LambdaTest retains an unlocated role when its opening text explicitly gives Noida', async () => {
  const lambdaTest = await loadLambdaTestModule()
  const jobs = lambdaTest.extractSearchResults([{
    id: 138113,
    title: 'Business Development Representative - APAC',
    description: '<div>Sales · Revenue 📍 Noida 🕐 Full-Time</div>',
    jobLocations: [],
    jobNumber: 'LT313',
  }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Noida, India')
  assert.equal(jobs[0].city, 'Noida')
})

test('extractSearchResults keeps only India LambdaTest jobs and normalizes the first-party JSON payload', async () => {
  const lambdaTest = await loadLambdaTestModule()

  assert.deepEqual(
    lambdaTest.extractSearchResults(activeJobsPayload),
    [
      {
        title: 'Solutions Engineer',
        company: 'LambdaTest',
        department: 'Application Support',
        location: 'Bangalore, KA, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '134349',
        requisitionId: 'LT307',
        sourceUrl: 'https://lambdatest.kekahire.com/jobdetails/134349',
        applyUrl: 'https://lambdatest.kekahire.com/jobdetails/134349',
        employmentType: 'Full Time',
        experienceRequired: '4-8 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Selenium', 'Playwright', 'Customer Communication'],
        postingDate: '2026-07-09',
        closingDate: null,
        jobDescription: 'Work with enterprise teams to unblock browser testing adoption.',
      },
      {
        title: 'Backend & Platform Engineer',
        company: 'LambdaTest',
        department: 'Platform Team- DevOps & Data Center',
        location: 'Noida, UP, India',
        city: 'Noida',
        country: 'India',
        jobId: '133031',
        requisitionId: 'LT302',
        sourceUrl: 'https://lambdatest.kekahire.com/jobdetails/133031',
        applyUrl: 'https://lambdatest.kekahire.com/jobdetails/133031',
        employmentType: 'Full Time',
        experienceRequired: '5-9 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Node.js', 'Kubernetes'],
        postingDate: '2026-06-29',
        closingDate: null,
        jobDescription: 'Build scalable backend systems for distributed testing workloads.',
      },
    ],
  )
})

test('run validates the LambdaTest first-party surface, verifies department payloads, and returns normalized India jobs', async () => {
  const lambdaTest = await loadLambdaTestModule()
  const requestedUrls = []

  const jobs = await lambdaTest.createLambdaTestScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push({ type: 'text', url })
      if (url === lambdaTest.OFFICIAL_CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected LambdaTest text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push({ type: 'json', url })
      if (url === lambdaTest.DEPARTMENTS_API_URL) return departmentsPayload
      if (url === lambdaTest.ACTIVE_JOBS_API_URL) return activeJobsPayload
      throw new Error(`Unexpected LambdaTest JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    { type: 'text', url: lambdaTest.OFFICIAL_CAREERS_URL },
    { type: 'json', url: lambdaTest.DEPARTMENTS_API_URL },
    { type: 'json', url: lambdaTest.ACTIVE_JOBS_API_URL },
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Solutions Engineer',
      company: 'LambdaTest',
      department: 'Application Support',
      location: 'Bangalore, KA, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '134349',
      requisitionId: 'LT307',
      sourceUrl: 'https://lambdatest.kekahire.com/jobdetails/134349',
      applyUrl: 'https://lambdatest.kekahire.com/jobdetails/134349',
      employmentType: 'Full Time',
      experienceRequired: '4-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Selenium', 'Playwright', 'Customer Communication'],
      postingDate: '2026-07-09',
      closingDate: null,
      jobDescription: 'Work with enterprise teams to unblock browser testing adoption.',
      source: 'lambdatest',
      link: 'https://lambdatest.kekahire.com/jobdetails/134349',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Backend & Platform Engineer',
      company: 'LambdaTest',
      department: 'Platform Team- DevOps & Data Center',
      location: 'Noida, UP, India',
      city: 'Noida',
      country: 'India',
      jobId: '133031',
      requisitionId: 'LT302',
      sourceUrl: 'https://lambdatest.kekahire.com/jobdetails/133031',
      applyUrl: 'https://lambdatest.kekahire.com/jobdetails/133031',
      employmentType: 'Full Time',
      experienceRequired: '5-9 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Node.js', 'Kubernetes'],
      postingDate: '2026-06-29',
      closingDate: null,
      jobDescription: 'Build scalable backend systems for distributed testing workloads.',
      source: 'lambdatest',
      link: 'https://lambdatest.kekahire.com/jobdetails/133031',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('LambdaTest fails closed when the first-party careers shell or departments API drifts', async () => {
  const lambdaTest = await loadLambdaTestModule()

  await assert.rejects(
    lambdaTest.createLambdaTestScraper().run({
      fetchText: async () => '<html><head><title>Careers</title></head><body><h1>Jobs</h1></body></html>',
      fetchJson: async (url) => {
        if (url === lambdaTest.DEPARTMENTS_API_URL) return departmentsPayload
        return activeJobsPayload
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    lambdaTest.createLambdaTestScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async (url) => {
        if (url === lambdaTest.DEPARTMENTS_API_URL) {
          return [{ departmentIdentifier: 'support', departmentName: 'Support' }]
        }
        return activeJobsPayload
      },
    }),
    /verified departments surface/i,
  )
})
