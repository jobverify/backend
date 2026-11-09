import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'

const loadSchneiderElectricModule = async () => {
  try {
    return await import('../../scraper/schneiderelectric/script.js')
  } catch {
    assert.fail('Expected Schneider Electric scraper module at ../../scraper/schneiderelectric/script.js')
  }
}

const searchPayload = {
  jobs: [
    {
      data: {
        slug: '126505',
        language: 'en-us',
        req_id: '126505',
        title: 'GM - Engineering',
        description: 'Lead control systems delivery for customer projects.',
        location_name: 'India-Tamil Nadu-Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        country_code: 'IN',
        categories: [{ name: 'Customer Projects, Solutions and Services' }],
        tags1: ['Full-Time'],
        qualifications: 'Graduate in Engineering with 10+ years of relevant experience.',
        responsibilities: 'Drive PLC, DCS and safety systems engineering execution.',
        posted_date: 'July 9, 2026',
        posting_expiry_date: '2026-07-30T18:30:00+0000',
        apply_url: 'https://careers-se.icims.com/jobs/126505/login',
        ats_code: 'icims',
        tags9: ['Chennai, Tamil Nadu, India'],
      },
    },
    {
      data: {
        slug: '126229',
        language: 'en-us',
        req_id: '126229',
        title: 'Outside India Role',
        description: 'Filtered out because it is not in India.',
        location_name: 'United States-Massachusetts-Boston',
        city: 'Boston',
        state: 'Massachusetts',
        country: 'United States',
        country_code: 'US',
        categories: [{ name: 'Sales' }],
        tags1: ['Full-Time'],
        qualifications: 'N/A',
        responsibilities: 'N/A',
        posted_date: 'July 9, 2026',
        posting_expiry_date: '2026-08-30T18:30:00+0000',
        apply_url: 'https://careers-se.icims.com/jobs/126229/login',
        ats_code: 'icims',
        tags9: ['Boston, Massachusetts, United States'],
      },
    },
  ],
  totalCount: 498,
  count: 497,
}

test('buildIndiaJobsApiUrl keeps Schneider Electric on the official India jobs API route', async () => {
  const { buildIndiaJobsApiUrl } = await loadSchneiderElectricModule()

  assert.equal(
    buildIndiaJobsApiUrl(),
    'https://careers.se.com/api/jobs?lang=en-US&page=1&sortBy=relevance&descending=false&internal=false&country=India',
  )
  assert.equal(
    buildIndiaJobsApiUrl({ page: 2 }),
    'https://careers.se.com/api/jobs?lang=en-US&page=2&sortBy=relevance&descending=false&internal=false&country=India',
  )
})

test('extractJobsPayload reads Schneider Electric totals and official job cards from the public jobs API', async () => {
  const { extractJobsPayload } = await loadSchneiderElectricModule()
  const payload = extractJobsPayload(searchPayload)

  assert.equal(payload.totalCount, 498)
  assert.equal(payload.count, 497)
  assert.equal(payload.jobs.length, 2)
  assert.equal(payload.jobs[0].data.req_id, '126505')
})

test('normalizeJobListing maps Schneider Electric API jobs into the shared scraper fields and filters to India', async () => {
  const {
    extractJobsPayload,
    normalizeJobListing,
  } = await loadSchneiderElectricModule()
  const payload = extractJobsPayload(searchPayload)
  const job = normalizeJobListing(payload.jobs[0])

  assert.deepEqual(job, {
    title: 'GM - Engineering',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    jobId: '126505',
    requisitionId: '126505',
    department: 'Customer Projects, Solutions and Services',
    employmentType: 'Full-time',
    experienceRequired: '10+ years',
    jobDescription: 'Lead control systems delivery for customer projects.',
    minimumQualification: 'Graduate in Engineering with 10+ years of relevant experience.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: 'July 9, 2026',
    closingDate: '2026-07-30T18:30:00+0000',
    applyUrl: 'https://careers-se.icims.com/jobs/126505/login',
    sourceUrl: 'https://careers.se.com/jobs/126505?lang=en-us',
    publicExperienceChecked: true,
  })

  assert.equal(normalizeJobListing(payload.jobs[1]), null)
})

test('run fetches Schneider Electric India jobs from the official API and decorates shared runner fields', async () => {
  const {
    buildIndiaJobsApiUrl,
    createSchneiderElectricScraper,
  } = await loadSchneiderElectricModule()
  const scraper = createSchneiderElectricScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedUrls = []

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaJobsApiUrl()) return searchPayload
      throw new Error(`Unexpected Schneider Electric fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [buildIndiaJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Schneider Electric')
  assert.equal(jobs[0].source, 'schneiderelectric')
  assert.equal(jobs[0].jobId, '126505')
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
  assert.equal(jobs[0].experienceRequired, '10+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(
    jobs[0].applyUrl,
    'https://careers-se.icims.com/jobs/126505/login',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})
