import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAthenahealthModule = async () => {
  try {
    return await import('../../scraper/athenahealth/script.js')
  } catch {
    assert.fail('Expected athenahealth scraper module at ../../scraper/scraper/athenahealth/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'athenahealth',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps athenahealth listings on the official Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadAthenahealthModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.athenahealth.com/us/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.athenahealth.com/us/en/search-results?from=10',
  )
})

test('extractSearchPayload reads athenahealth embedded Phenom search payloads and India aggregation counts', async () => {
  const { extractSearchPayload } = await loadAthenahealthModule()
  const payload = extractSearchPayload(readFixture('search-results-page-0.html'))

  assert.equal(payload.widgetApiEndpoint, 'https://careers.athenahealth.com/widgets')
  assert.equal(payload.totalHits, 92)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 50)
  assert.equal(payload.jobs[0].reqId, 'R15060')
})

test('extractSearchResults normalizes athenahealth India listings into the shared scraper fields', async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadAthenahealthModule()
  const jobs = extractSearchResults(
    extractSearchPayload(readFixture('search-results-page-0.html')),
  )
  const backendRole = jobs.find((job) => job.jobId === 'R15060')

  assert.deepEqual({ ...backendRole, requiredSkills: [] }, {
    title: 'Senior Member Of Technical Staff- Backend',
    location: 'Pune, Mahārāshtra, India',
    city: 'Pune',
    country: 'India',
    jobId: 'R15060',
    requisitionId: 'R15060',
    department: 'Product Engineering & Data Science',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Join us as we work to create a thriving ecosystem that delivers accessible, high-quality, and sustainable healthcare for all. Role summary. Build scalable, reliable full-stack capabilities that hel...',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-10T00:00:00.000+0000',
    applyUrl: 'https://athenahealth.wd1.myworkdayjobs.com/External/job/Pune-India/Senior-Member-Of-Technical-Staff--Full-Stack-_R15060/apply',
    sourceUrl: 'https://careers.athenahealth.com/us/en/job/R15060/Senior-Member-Of-Technical-Staff-Backend',
  })

  assert.ok(backendRole.requiredSkills.includes('spring boot'))
  assert.ok(backendRole.requiredSkills.includes('aws'))
})

test('extractJobDetail reads athenahealth job detail metadata and Workday apply links from the official detail page', async () => {
  const { extractJobDetail } = await loadAthenahealthModule()
  const detail = extractJobDetail(readFixture('job-detail-R15060.html'), {
    title: 'Senior Member Of Technical Staff- Backend',
    location: 'Pune, Mahārāshtra, India',
    city: 'Pune',
    country: 'India',
    jobId: 'R15060',
    requisitionId: 'R15060',
    department: 'Product Engineering & Data Science',
    sourceUrl: 'https://careers.athenahealth.com/us/en/job/R15060/Senior-Member-Of-Technical-Staff-Backend',
  })

  assert.equal(detail.title, 'Senior Member Of Technical Staff- Backend')
  assert.match(detail.location, /^Pune, Mah.*shtra, India$/i)
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'R15060')
  assert.equal(detail.requisitionId, 'R15060')
  assert.equal(detail.department, 'Product Engineering & Data Science')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(
    detail.experienceRequired,
    '4 to 7 years',
  )
  assert.match(detail.minimumQualification, /Bachelor/)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-06-14')
  assert.equal(
    detail.applyUrl,
    'https://athenahealth.wd1.myworkdayjobs.com/External/job/Pune-India/Senior-Member-Of-Technical-Staff--Full-Stack-_R15060/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.athenahealth.com/us/en/job/R15060/Senior-Member-Of-Technical-Staff-Backend',
  )
  assert.match(detail.jobDescription, /full-stack capabilities/i)
  assert.ok(detail.requiredSkills.includes('spring boot'))
})

test('run keeps athenahealth jobs on the official Phenom search route and decorates shared runner fields', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadAthenahealthModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) {
        return readFixture('search-results-page-0.html')
      }
      if (url === 'https://careers.athenahealth.com/us/en/job/R15060/Senior-Member-Of-Technical-Staff-Backend') {
        return readFixture('job-detail-R15060.html')
      }
      throw new Error(`Unexpected athenahealth fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(),
    'https://careers.athenahealth.com/us/en/job/R15060/Senior-Member-Of-Technical-Staff-Backend',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'athenahealth')
  assert.equal(jobs[0].source, 'athenahealth')
  assert.equal(jobs[0].jobId, 'R15060')
  assert.equal(
    jobs[0].applyUrl,
    'https://athenahealth.wd1.myworkdayjobs.com/External/job/Pune-India/Senior-Member-Of-Technical-Staff--Full-Stack-_R15060/apply',
  )
})
