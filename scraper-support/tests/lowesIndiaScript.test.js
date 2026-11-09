import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadLowesModule = async () => {
  try {
    return await import('../../scraper/lowesindia/script.js')
  } catch {
    assert.fail("Expected Lowe's India scraper module at ../../scraper/lowesindia/script.js")
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lowesindia',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test("buildSearchResultsPageUrl keeps Lowe's India listings on the official Phenom search route", async () => {
  const { buildSearchResultsPageUrl } = await loadLowesModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://talent.lowes.com/in/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://talent.lowes.com/in/en/search-results?from=10',
  )
})

test("extractSearchPayload reads Lowe's embedded Phenom search payloads", async () => {
  const { extractSearchPayload } = await loadLowesModule()
  const payload = extractSearchPayload(readFixture('search-results-page-0.html'))

  assert.equal(payload.widgetApiEndpoint, 'https://talent.lowes.com/widgets')
  assert.equal(payload.totalHits, 69)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.jobs[0].reqId, 'JR-02563681')
})

test("extractSearchResults normalizes Lowe's India listings into the shared scraper fields", async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadLowesModule()
  const jobs = extractSearchResults(
    extractSearchPayload(readFixture('search-results-page-0.html')),
  )
  const paidSocialRole = jobs.find((job) => job.jobId === 'JR-02563681')

  assert.deepEqual({ ...paidSocialRole, requiredSkills: [] }, {
    title: 'Senior Analyst \u2013 Paid Social',
    location: 'Bengaluru, Karn\u0101taka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'JR-02563681',
    requisitionId: 'JR-02563681',
    department: 'Corporate',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      "We are looking for a Senior Analyst \u2013 Paid Social to drive innovative digital marketing strategies at Lowe's. This role involves managing and optimizing paid media campaigns across various platforms to enhance brand visibility and profitability. Join us in shaping the future of home improvement retail!",
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-18T00:00:00.000+0000',
    applyUrl: 'https://lowes.wd5.myworkdayjobs.com/LWS_External_CS/job/Bengaluru/Senior-Analyst---Paid-Social_JR-02563681/apply',
    sourceUrl: 'https://talent.lowes.com/in/en/job/LOWEUSJR02563681EXTERNALENIN/Senior-Analyst-Paid-Social',
  })

  assert.ok(paidSocialRole.requiredSkills.includes('facebook ad manager'))
  assert.ok(paidSocialRole.requiredSkills.includes('ga4'))
})

test("extractJobDetail reads Lowe's India job detail metadata and Workday apply links from the official detail page", async () => {
  const { extractJobDetail } = await loadLowesModule()
  const detail = extractJobDetail(readFixture('job-detail-JR-02563681.html'), {
    title: 'Senior Analyst \u2013 Paid Social',
    location: 'Bengaluru, Karn\u0101taka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'JR-02563681',
    requisitionId: 'JR-02563681',
    department: 'Corporate',
    sourceUrl: 'https://talent.lowes.com/in/en/job/JR-02563681/Senior-Analyst-Paid-Social',
  })

  assert.equal(detail.title, 'Senior Analyst \u2013 Paid Social')
  assert.equal(detail.location, 'Bengaluru, Karn\u0101taka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'JR-02563681')
  assert.equal(detail.requisitionId, 'JR-02563681')
  assert.equal(detail.department, 'Corporate')
  assert.equal(detail.employmentType, 'Probation')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.match(detail.minimumQualification, /Bachelor/i)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-07-08')
  assert.equal(
    detail.applyUrl,
    'https://lowes.wd5.myworkdayjobs.com/LWS_External_CS/job/Bengaluru/Senior-Analyst---Paid-Social_JR-02563681/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://talent.lowes.com/in/en/job/JR-02563681/Senior-Analyst-Paid-Social',
  )
  assert.match(detail.jobDescription, /Paid Social team analyze sales data/i)
  assert.ok(detail.requiredSkills.includes('facebook ad manager'))
})

test("run keeps Lowe's India jobs on the official Phenom search route and decorates shared runner fields", async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadLowesModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) {
        return readFixture('search-results-page-0.html')
      }
      if (url === 'https://talent.lowes.com/in/en/job/LOWEUSJR02563681EXTERNALENIN/Senior-Analyst-Paid-Social') {
        return readFixture('job-detail-JR-02563681.html')
      }
      throw new Error(`Unexpected Lowe's fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(),
    'https://talent.lowes.com/in/en/job/LOWEUSJR02563681EXTERNALENIN/Senior-Analyst-Paid-Social',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Lowes India')
  assert.equal(jobs[0].source, 'lowesindia')
  assert.equal(jobs[0].jobId, 'JR-02563681')
  assert.equal(jobs[0].location, 'Bengaluru, Karn\u0101taka, India')
  assert.equal(
    jobs[0].applyUrl,
    'https://lowes.wd5.myworkdayjobs.com/LWS_External_CS/job/Bengaluru/Senior-Analyst---Paid-Social_JR-02563681/apply',
  )
})
