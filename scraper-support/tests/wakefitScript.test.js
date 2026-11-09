import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'

const loadWakefitModule = async () => {
  try {
    return await import('../../scraper/wakefit/script.js')
  } catch {
    assert.fail('Expected Wakefit scraper module at ../../scraper/wakefit/script.js')
  }
}

test('Wakefit scraper keeps the verified Darwinbox public routes explicit and only decorates India jobs', async () => {
  const {
    OFFICIAL_SITE_URL,
    OFFICIAL_CAREERS_HANDOFF_URL,
    PUBLIC_ALL_JOBS_URL,
    createWakefitScraper,
    transformWakefitJob,
  } = await loadWakefitModule()

  assert.equal(OFFICIAL_SITE_URL, 'https://www.wakefit.co/')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://wakefit.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_ALL_JOBS_URL,
    'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )

  const scraper = createWakefitScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://wakefit.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('wake-001'),
    'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
  )

  const indiaRecord = {
    id: 'wake-001',
    title: 'Software Development Engineer II',
    department_name: 'Engineering',
    locations: 'Bengaluru, Karnataka, India',
    country: 'India',
    emp_type_name: 'Full Time',
    experience: '3 - 5 Years',
    posted_on: '09-Jul-2026',
    jd: '<p>Build catalog and checkout experiences for omnichannel retail.</p>',
  }

  const singaporeRecord = {
    id: 'wake-sg-001',
    title: 'Retail Planner - Singapore',
    department_name: 'Retail',
    locations: 'Singapore',
    country: 'Singapore',
    emp_type_name: 'Full Time',
    experience: '5 - 7 Years',
    posted_on: '09-Jul-2026',
    jd: '<p>Coordinate store planning across the region.</p>',
  }

  assert.deepEqual(transformWakefitJob(indiaRecord), {
    title: 'Software Development Engineer II',
    company: 'Wakefit',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'wake-001',
    requisitionId: null,
    sourceUrl: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
    applyUrl: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
    employmentType: 'Full Time',
    experienceRequired: '3 - 5 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '09-Jul-2026',
    closingDate: null,
    jobDescription: '<p>Build catalog and checkout experiences for omnichannel retail.</p>',
  })
  assert.equal(transformWakefitJob(singaporeRecord), null)

  const requestedPages = []
  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [indiaRecord, singaporeRecord],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Software Development Engineer II',
      company: 'Wakefit',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'wake-001',
      requisitionId: null,
      sourceUrl: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
      applyUrl: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '09-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build catalog and checkout experiences for omnichannel retail.</p>',
      source: 'wakefit',
      link: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Wakefit live run delegates to the shared Darwinbox browser-session scraper', async () => {
  const { createWakefitScraper } = await loadWakefitModule()
  const delegatedJobs = [
    {
      title: 'Backend Engineer',
      source: 'wakefit',
      link: 'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/wake-002',
    },
  ]
  const runCalls = []
  const scraper = createWakefitScraper({
    fetchJson: async () => assert.fail('live Wakefit runs should not use direct Darwinbox fetchJson'),
    darwinboxScraper: {
      run: async (options) => {
        runCalls.push(options)
        return delegatedJobs
      },
    },
  })

  const jobs = await scraper.run({ maxPages: 2, maxJobs: 1 })

  assert.deepEqual(runCalls, [{ maxPages: 2, maxJobs: 1 }])
  assert.equal(jobs, delegatedJobs)
})
