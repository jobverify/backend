import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAllianzModule = async () => {
  try {
    return await import('../../scraper/allianz/script.js')
  } catch {
    assert.fail('Expected Allianz scraper module at ../../scraper/scraper/allianz/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'allianz',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Allianz listings on the official Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadAllianzModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.allianz.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(40),
    'https://careers.allianz.com/global/en/search-results?from=40',
  )
})

test('extractSearchPayload reads Allianz embedded Phenom search payloads and India aggregation counts', async () => {
  const { extractSearchPayload } = await loadAllianzModule()
  const payload = extractSearchPayload(readFixture('search-results-page-40.html'))

  assert.equal(payload.totalHits, 1921)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 96)
  assert.equal(payload.jobs[0].reqId, '98739')
})

test('extractSearchResults normalizes Allianz India listings into the shared scraper fields', async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadAllianzModule()
  const jobs = extractSearchResults(
    extractSearchPayload(readFixture('search-results-page-40.html')),
  )
  const integrationArchitect = jobs.find((job) => job.jobId === '90730')

  assert.deepEqual({ ...integrationArchitect, requiredSkills: [] }, {
    title: 'Integration Architect _1915',
    location: 'India',
    city: 'India',
    country: 'India',
    jobId: '90730',
    requisitionId: '90730',
    department: 'IT & Tech Engineering',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Step into the role of Integration Architecture Lead and drive enterprise-scale integration solutions across insurance platforms. Lead strategic integrations, collaborate with cross-functional teams, and ensure secure, scalable, and compliant architectures. Bring your expertise in API-first, event-driven patterns, and cloud-native services to shape the future of digital insurance integration.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-18T06:49:40.000+0000',
    applyUrl: 'https://career5.successfactors.eu/careers?company=AZGROUPPROD&career_job_req_id=90730&career_ns=job_application',
    sourceUrl: 'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  })

  assert.ok(integrationArchitect.requiredSkills.includes('api-first integration'))
  assert.ok(integrationArchitect.requiredSkills.includes('java'))
})

test('extractJobDetail reads Allianz job detail metadata and the SuccessFactors apply link from the official detail page', async () => {
  const { extractJobDetail } = await loadAllianzModule()
  const detail = extractJobDetail(readFixture('job-detail-90730.html'), {
    title: 'Integration Architect _1915',
    location: 'India',
    city: 'India',
    country: 'India',
    jobId: '90730',
    requisitionId: '90730',
    department: 'IT & Tech Engineering',
    sourceUrl: 'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  })

  assert.equal(detail.title, 'Integration Architect _1915')
  assert.equal(detail.location, 'India')
  assert.equal(detail.city, 'India')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '90730')
  assert.equal(detail.requisitionId, '90730')
  assert.equal(detail.department, 'IT & Tech Engineering')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '13 - 15+ years')
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-05-26')
  assert.equal(
    detail.applyUrl,
    'https://career5.successfactors.eu/careers?company=AZGROUPPROD&career_job_req_id=90730&career_ns=job_application',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  )
  assert.match(detail.jobDescription, /integration architecture lead/i)
  assert.ok(detail.requiredSkills.includes('event-driven architecture'))
  assert.ok(detail.requiredSkills.includes('aws'))
})

test('run keeps Allianz jobs on the official Phenom search route and decorates shared runner fields', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadAllianzModule()
  const requestedUrls = []

  const jobs = await run({
    initialFrom: 40,
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchResultsPageUrl(40)) {
        return readFixture('search-results-page-40.html')
      }
      if (url === 'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915') {
        return readFixture('job-detail-90730.html')
      }
      throw new Error(`Unexpected Allianz fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchResultsPageUrl(40),
    'https://careers.allianz.com/global/en/job/90730/Integration-Architect-1915',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Allianz')
  assert.equal(jobs[0].source, 'allianz')
  assert.equal(jobs[0].jobId, '90730')
  assert.equal(jobs[0].location, 'India')
  assert.equal(
    jobs[0].applyUrl,
    'https://career5.successfactors.eu/careers?company=AZGROUPPROD&career_job_req_id=90730&career_ns=job_application',
  )
})
