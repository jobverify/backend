import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAonModule = async () => {
  try {
    return await import('../../scraper/aon/script.js')
  } catch {
    assert.fail('Expected AON scraper module at ../../scraper/scraper/aon/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'aon',
)

const readFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildIndiaJobsApiUrl keeps AON on the official India jobs API route', async () => {
  const { buildIndiaJobsApiUrl } = await loadAonModule()

  assert.equal(
    buildIndiaJobsApiUrl(),
    'https://jobs.aon.com/api/jobs?location=India&limit=100&page=1',
  )
  assert.equal(
    buildIndiaJobsApiUrl({ page: 2, limit: 50 }),
    'https://jobs.aon.com/api/jobs?location=India&limit=50&page=2',
  )
})

test('extractJobsPayload reads AON India totals and job cards from the official jobs API', async () => {
  const { extractJobsPayload } = await loadAonModule()
  const payload = extractJobsPayload(readFixture('india-jobs.json'))

  assert.equal(payload.totalCount, 24)
  assert.equal(payload.count, 24)
  assert.equal(payload.jobs.length, 24)
  assert.equal(payload.jobs[0].data.req_id, '96351')
})

test('normalizeJobListing maps AON API jobs into the shared scraper fields', async () => {
  const {
    extractJobsPayload,
    normalizeJobListing,
  } = await loadAonModule()
  const payload = extractJobsPayload(readFixture('india-jobs.json'))
  const job = normalizeJobListing(payload.jobs[0])

  assert.deepEqual({ ...job, requiredSkills: [] }, {
    title: 'Senior Consultant - Compensation & Rewards Advisory',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '96351',
    requisitionId: '96351',
    department: 'Human Capital Solutions',
    employmentType: 'Full-time',
    experienceRequired: '4-6 years of relevant experience post master’s or 7-8 years of relevant experience after graduation in the area of compensation & benefits, rewards strategy design, job evaluation, incentive design, skill gap analysis, organization restructuring, talent management projects relevant pre-mba experience in the areas we operate.',
    jobDescription: job.jobDescription,
    minimumQualification: 'Full Time Bachelors/ master’s degree in related discipline (HR, Economics, Statistics, Analytics and Business Administration) M.B.A/PGDBM from any Tier 1/Tier 2/Tier 3 institute Work Experience: 4-6 years of relevant experience post master’s or 7-8 years of relevant experience after graduation in the area of compensation & benefits, rewards strategy design, job evaluation, incentive design, skill gap analysis, organization restructuring, talent management projects Relevant pre-MBA experience in the areas we operate.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-03-06T04:57:00+0000',
    applyUrl: 'https://india-careers-aon.icims.com/jobs/96351/login',
    sourceUrl: 'https://jobs.aon.com/jobs/96351?lang=en-us',
  })

  assert.match(job.jobDescription, /Talent Solutions Consulting/i)
  assert.ok(job.requiredSkills.includes('excel'))
  assert.ok(job.requiredSkills.includes('analytics'))
})

test('run fetches AON India jobs from the official API and decorates shared runner fields', async () => {
  const {
    buildIndiaJobsApiUrl,
    createAonScraper,
  } = await loadAonModule()
  const scraper = createAonScraper()
  const requestedUrls = []

  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === buildIndiaJobsApiUrl()) {
        return readFixture('india-jobs.json')
      }
      throw new Error(`Unexpected AON fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [buildIndiaJobsApiUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Aon')
  assert.equal(jobs[0].source, 'aon')
  assert.equal(jobs[0].jobId, '96351')
  assert.equal(jobs[0].location, 'Mumbai, India')
  assert.equal(
    jobs[0].applyUrl,
    'https://india-careers-aon.icims.com/jobs/96351/login',
  )
})
