import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadSignifyModule = async () => {
  try {
    return await import('../../scraper/signifyinnovationlabs/script.js')
  } catch {
    assert.fail('Expected Signify Innovation Labs scraper module at ../../scraper/signifyinnovationlabs/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'signifyinnovationlabs',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Signify Innovation Labs listings on the official Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadSignifyModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://www.careers.signify.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://www.careers.signify.com/global/en/search-results?from=10',
  )
})

test('extractSearchPayload reads Signify embedded Phenom search payloads and India aggregation counts', async () => {
  const { extractSearchPayload } = await loadSignifyModule()
  const payload = extractSearchPayload(readFixture('search-results-page-0.html'))

  assert.equal(payload.widgetApiEndpoint, 'https://www.careers.signify.com/widgets')
  assert.equal(payload.totalHits, 240)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 36)
  assert.equal(payload.jobs[0].reqId, '363770')
})

test('extractSearchResults normalizes Signify India listings into the shared scraper fields', async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadSignifyModule()
  const jobs = extractSearchResults(
    extractSearchPayload(readFixture('search-results-page-0.html')),
  )
  const sapBasisRole = jobs.find((job) => job.jobId === '361860')

  assert.deepEqual({ ...sapBasisRole, requiredSkills: [] }, {
    title: 'SAP Basis Consultant \u2013 Core ERP Team',
    location: 'Bangalore, Karn\u0101taka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '361860',
    requisitionId: '361860',
    department: 'Digital(IT)',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Embrace the role of an SAP Basis Consultant and play a key role in managing, optimizing, and securing SAP ECC and S/4HANA environments. Collaborate with cross-functional teams, drive system modernization, and ensure high availability and performance. Grow your career with cutting-edge technologies and continuous improvement initiatives in a dynamic, global organization.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-03-24T00:00:00.000+0000',
    applyUrl: 'https://lighting.wd3.myworkdayjobs.com/jobs-and-careers/job/Bangalore/SAP-Basis-Consultant---Core-ERP-Team_361860/apply',
    sourceUrl: 'https://www.careers.signify.com/global/en/job/361860/SAP-Basis-Consultant-Core-ERP-Team',
  })

  assert.ok(sapBasisRole.requiredSkills.includes('sap basis administration'))
  assert.ok(sapBasisRole.requiredSkills.includes('aws'))
})

test('extractJobDetail reads Signify job detail metadata and Workday apply links from the official detail page', async () => {
  const { extractJobDetail } = await loadSignifyModule()
  const detail = extractJobDetail(readFixture('job-detail-361860.html'), {
    title: 'SAP Basis Consultant \u2013 Core ERP Team',
    location: 'Bangalore, Karn\u0101taka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '361860',
    requisitionId: '361860',
    department: 'Digital(IT)',
    sourceUrl: 'https://www.careers.signify.com/global/en/job/361860/SAP-Basis-Consultant-Core-ERP-Team',
  })

  assert.equal(detail.title, 'SAP Basis Consultant \u2013 Core ERP Team')
  assert.equal(detail.location, 'Bangalore, Karn\u0101taka, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '361860')
  assert.equal(detail.requisitionId, '361860')
  assert.equal(detail.department, 'Digital(IT)')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.experienceRequired, /8\s*(?:-|–)\s*10 years/i)
  assert.match(detail.minimumQualification, /Bachelor/i)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-04-28')
  assert.equal(
    detail.applyUrl,
    'https://lighting.wd3.myworkdayjobs.com/jobs-and-careers/job/Bangalore/SAP-Basis-Consultant---Core-ERP-Team_361860/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://www.careers.signify.com/global/en/job/361860/SAP-Basis-Consultant-Core-ERP-Team',
  )
  assert.match(detail.jobDescription, /Through bold discovery and cutting-edge innovation/i)
  assert.ok(detail.requiredSkills.includes('sap basis administration'))
})

test('run keeps Signify jobs on the official Phenom search route and decorates shared runner fields', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadSignifyModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl()) {
        return readFixture('search-results-page-0.html')
      }
      if (url === 'https://www.careers.signify.com/global/en/job/363770/Lead-Software-Quality-Engineer') {
        return readFixture('job-detail-363770.html')
      }
      throw new Error(`Unexpected Signify fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(),
    'https://www.careers.signify.com/global/en/job/363770/Lead-Software-Quality-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Signify Innovation Labs')
  assert.equal(jobs[0].source, 'signifyinnovationlabs')
  assert.equal(jobs[0].jobId, '363770')
  assert.equal(jobs[0].location, 'Bangalore, Karn\u0101taka, India')
  assert.equal(
    jobs[0].applyUrl,
    'https://lighting.wd3.myworkdayjobs.com/jobs-and-careers/job/Bangalore/Lead-Software-Quality-Engineer_363770/apply',
  )
})
