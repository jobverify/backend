import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper-support/tests/fixtures/leicabiosystems',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadLeicaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Leica Biosystems scraper module at ./script.js')
  }
}

test('Leica Biosystems keeps Danaher Phenom searches on the verified keyword route', async () => {
  const leica = await loadLeicaModule()

  assert.equal(
    leica.buildSearchResultsPageUrl(),
    'https://jobs.danaher.com/global/en/search-results?keywords=Leica',
  )
  assert.equal(
    leica.buildSearchResultsPageUrl(30),
    'https://jobs.danaher.com/global/en/search-results?keywords=Leica&from=30',
  )
})

test('Leica Biosystems extracts India jobs only after filtering Danaher Leica results by opco and country', async () => {
  const leica = await loadLeicaModule()

  const payload = leica.extractSearchPayload(readFixture('search-results-page-30.html'))
  const jobs = leica.extractSearchResults(payload)

  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 8)
  assert.equal(payload.aggregations.opco['Leica Biosystems'], 87)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Sales Manager- AP and Telangana (Location - Hyderabad)')
  assert.equal(jobs[0].location, 'Hyderabad, India')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, 'R1309303')
  assert.equal(jobs[0].requisitionId, 'R1309303')
  assert.equal(jobs[0].department, 'Sales')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, null)
  assert.match(jobs[0].jobDescription, /Sales Manager/i)
  assert.equal(jobs[0].minimumQualification, null)
  assert.equal(jobs[0].preferredQualification, null)
  assert.deepEqual(jobs[0].requiredSkills.slice(0, 5), [
    'sales funnel management',
    'key account management',
    'contract negotiation',
    'crm (sfdc)',
    'market analysis',
  ])
  assert.equal(jobs[0].postingDate, '2026-06-26T00:00:00.000+0000')
  assert.equal(
    jobs[0].applyUrl,
    'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/IND---Hyderabad---DHR-Holding-India-Pvt-Ltd/Sales-Manager--AP-and-Telangana--Location---Hyderabad-_R1309303/apply',
  )
  assert.equal(
    jobs[0].sourceUrl,
    'https://jobs.danaher.com/global/en/job/R1309303/Sales-Manager-AP-and-Telangana-Location-Hyderabad',
  )
})

test('Leica Biosystems extracts job detail metadata from the official Danaher detail page', async () => {
  const leica = await loadLeicaModule()

  const detail = leica.extractJobDetail(readFixture('job-detail-R1309303.html'), {
    title: 'Sales Manager- AP and Telangana (Location - Hyderabad)',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'R1309303',
    requisitionId: 'R1309303',
    department: 'Sales',
    applyUrl: 'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/IND---Hyderabad---DHR-Holding-India-Pvt-Ltd/Sales-Manager--AP-and-Telangana--Location---Hyderabad-_R1309303/apply',
    sourceUrl: 'https://jobs.danaher.com/global/en/job/R1309303/Sales-Manager-AP-and-Telangana-Location-Hyderabad',
  })

  assert.equal(detail.title, 'Sales Manager- AP and Telangana (Location - Hyderabad)')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'R1309303')
  assert.equal(detail.requisitionId, 'R1309303')
  assert.equal(detail.department, 'Sales')
  assert.equal(detail.employmentType, 'Full-time')
  assert.match(detail.location, /Hyderabad/i)
  assert.match(detail.jobDescription, /driving commercial growth/i)
  assert.match(detail.experienceRequired, /8\+ years/i)
  assert.equal(detail.minimumQualification, null)
  assert.deepEqual(detail.requiredSkills.slice(0, 4), [
    'sales funnel management',
    'key account management',
    'contract negotiation',
    'crm (sfdc)',
  ])
  assert.equal(detail.postingDate, '2026-06-30')
  assert.equal(
    detail.applyUrl,
    'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/IND---Hyderabad---DHR-Holding-India-Pvt-Ltd/Sales-Manager--AP-and-Telangana--Location---Hyderabad-_R1309303/apply',
  )
})

test('Leica Biosystems pagination skips earlier non-India keyword pages and returns the first India match', async () => {
  const leica = await loadLeicaModule()
  const requestedUrls = []

  const jobs = await leica.run({
    maxPages: 4,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === leica.buildSearchResultsPageUrl()) return readFixture('search-results-page-0.html')
      if (url === leica.buildSearchResultsPageUrl(10)) return readFixture('search-results-page-10.html')
      if (url === leica.buildSearchResultsPageUrl(20)) return readFixture('search-results-page-20.html')
      if (url === leica.buildSearchResultsPageUrl(30)) return readFixture('search-results-page-30.html')
      if (url === 'https://jobs.danaher.com/global/en/job/R1309303/Sales-Manager-AP-and-Telangana-Location-Hyderabad') {
        return readFixture('job-detail-R1309303.html')
      }
      throw new Error(`Unexpected Leica fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    leica.buildSearchResultsPageUrl(),
    leica.buildSearchResultsPageUrl(10),
    leica.buildSearchResultsPageUrl(20),
    leica.buildSearchResultsPageUrl(30),
    'https://jobs.danaher.com/global/en/job/R1309303/Sales-Manager-AP-and-Telangana-Location-Hyderabad',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Leica Biosystems')
  assert.equal(jobs[0].source, 'leicabiosystems')
  assert.equal(jobs[0].jobId, 'R1309303')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(
    jobs[0].applyUrl,
    'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/IND---Hyderabad---DHR-Holding-India-Pvt-Ltd/Sales-Manager--AP-and-Telangana--Location---Hyderabad-_R1309303/apply',
  )
})
