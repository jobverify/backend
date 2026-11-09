import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-09T00:00:00.000Z'

const loadLeadSquaredModule = async () => {
  try {
    return await import('../../scraper/leadsquared/script.js')
  } catch {
    assert.fail('Expected LeadSquared scraper module at ../../scraper/scraper/leadsquared/script.js')
  }
}

test('LeadSquared scraper keeps the Darwinbox contract explicit and only decorates India jobs', async () => {
  const {
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    ALL_JOBS_ENDPOINT,
    JOB_COUNT_ENDPOINT,
    createLeadSquaredScraper,
    transformLeadSquaredJob,
  } = await loadLeadSquaredModule()

  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.leadsquared.com/careers/')
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(ALL_JOBS_ENDPOINT, 'job/alljobs')
  assert.equal(JOB_COUNT_ENDPOINT, 'candidate/job/count')

  const scraper = createLeadSquaredScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildListingApiUrl(),
    'https://leadsquaredhrms.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('lead-001'),
    'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
  )

  const indiaRecord = {
    id: 'lead-001',
    title: 'Senior Software Engineer',
    department_name: 'Engineering',
    locations: 'Bengaluru, Karnataka, India',
    country: 'India',
    emp_type_name: 'Full Time',
    experience: '4 - 8 Years',
    posted_on: '08-Jul-2026',
    jd: '<p>Build workflow automation features for revenue teams.</p>',
  }

  const usRecord = {
    id: 'lead-us-001',
    title: 'Account Executive - US',
    department_name: 'Sales',
    locations: 'Dallas, Texas, United States',
    country: 'United States',
    emp_type_name: 'Full Time',
    experience: '6 - 10 Years',
    posted_on: '08-Jul-2026',
    jd: '<p>Drive regional pipeline growth.</p>',
  }

  assert.deepEqual(transformLeadSquaredJob(indiaRecord), {
    title: 'Senior Software Engineer',
    company: 'LeadSquared',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'lead-001',
    requisitionId: null,
    sourceUrl: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
    applyUrl: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
    employmentType: 'Full Time',
    experienceRequired: '4 - 8 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '08-Jul-2026',
    closingDate: null,
    jobDescription: '<p>Build workflow automation features for revenue teams.</p>',
  })
  assert.equal(transformLeadSquaredJob(usRecord), null)

  const requestedPages = []
  const jobs = await scraper.run({
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [indiaRecord, usRecord],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Software Engineer',
      company: 'LeadSquared',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'lead-001',
      requisitionId: null,
      sourceUrl: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
      applyUrl: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
      employmentType: 'Full Time',
      experienceRequired: '4 - 8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '08-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build workflow automation features for revenue teams.</p>',
      source: 'leadsquared',
      link: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('LeadSquared live run delegates to the shared Darwinbox browser-session scraper', async () => {
  const { createLeadSquaredScraper } = await loadLeadSquaredModule()
  const delegatedJobs = [
    {
      title: 'Platform Engineer',
      source: 'leadsquared',
      link: 'https://leadsquaredhrms.darwinbox.in/ms/candidatev2/main/careers/jobDetails/lead-002',
    },
  ]
  const runCalls = []
  const scraper = createLeadSquaredScraper({
    fetchJson: async () => assert.fail('live LeadSquared runs should not use direct Darwinbox fetchJson'),
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
