import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadBeckmanModule = async () => {
  try {
    return await import('../../scraper/beckmancoulterdiagnostics/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'beckmancoulterdiagnostics',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Beckman listings on the Danaher Phenom keyword route', async () => {
  const beckman = await loadBeckmanModule()
  assert.ok(beckman)

  assert.equal(
    beckman.buildSearchResultsPageUrl(),
    'https://jobs.danaher.com/global/en/search-results?keywords=Beckman',
  )
  assert.equal(
    beckman.buildSearchResultsPageUrl(10),
    'https://jobs.danaher.com/global/en/search-results?keywords=Beckman&from=10',
  )
})

test('extractSearchPayload reads Danaher Phenom payloads for Beckman keyword results', async () => {
  const beckman = await loadBeckmanModule()
  assert.ok(beckman)

  const payload = beckman.extractSearchPayload(readFixture('search-results-page-1.html'))

  assert.equal(payload.totalHits, 421)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 49)
  assert.equal(payload.jobs[0].reqId, 'R1309202')
  assert.equal(payload.jobs[0].opco, 'Beckman Coulter Diagnostics')
})

test('extractSearchResults keeps only Beckman Coulter Diagnostics jobs in India', async () => {
  const beckman = await loadBeckmanModule()
  assert.ok(beckman)

  const jobs = beckman.extractSearchResults(
    beckman.extractSearchPayload(readFixture('search-results-page-1.html')),
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Lead software Engineer',
    location: 'Bangalore, Karnātaka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'R1310882',
    requisitionId: 'R1310882',
    department: 'Digital Products Development',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Embrace the role of a Lead Software Engineer and drive innovation in life sciences diagnostics. Architect, design, and implement robust software solutions using Java, Azure, and modern frameworks. Collaborate with cross-functional teams to deliver impactful products in a regulated environment. Shape the future of clinical diagnostics with Beckman Coulter Diagnostics.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'java',
      'j2ee',
      'angularjs',
      'react',
      'linux',
      'python',
      'shell scripting',
      'devops',
      'continuous integration',
      'continuous delivery',
      'continuous deployment',
      'version control',
      'git',
      'azure',
      'software architecture',
      'software design',
      'prototyping',
      'root cause analysis',
      'agile',
      'medical device development',
    ],
    postingDate: '2026-05-22T00:00:00.000+0000',
    applyUrl: 'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/Bangalore-Karnataka-India/Lead-software-Engineer_R1310882/apply',
    sourceUrl: 'https://jobs.danaher.com/global/en/job/R1310882/Lead-software-Engineer',
  })
  assert.equal(jobs[1].jobId, 'R1314373')
  assert.equal(jobs[1].country, 'India')
})

test('extractJobDetail reads Beckman job detail metadata and apply links from Danaher Phenom pages', async () => {
  const beckman = await loadBeckmanModule()
  assert.ok(beckman)

  const detail = beckman.extractJobDetail(readFixture('job-detail-R1310882.html'), {
    title: 'Lead software Engineer',
    location: 'Bangalore, Karnātaka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'R1310882',
    requisitionId: 'R1310882',
    department: 'Digital Products Development',
    applyUrl: 'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/Bangalore-Karnataka-India/Lead-software-Engineer_R1310882/apply',
    sourceUrl: 'https://jobs.danaher.com/global/en/job/R1310882/Lead-software-Engineer',
  })

  assert.equal(detail.title, 'Lead software Engineer')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'R1310882')
  assert.equal(detail.requisitionId, 'R1310882')
  assert.equal(detail.department, 'Digital Products Development')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '7+ years')
  assert.match(detail.location, /Bangalore/i)
  assert.match(detail.jobDescription, /architect, design, Code, debug and implement software features/i)
  assert.match(detail.minimumQualification, /Bachelor’s\/Master’s degree/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'java',
    'j2ee',
    'angularjs',
  ])
  assert.equal(detail.postingDate, '2026-06-27')
  assert.equal(
    detail.applyUrl,
    'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/Bangalore-Karnataka-India/Lead-software-Engineer_R1310882/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://jobs.danaher.com/global/en/job/R1310882/Lead-software-Engineer',
  )
})

test('run skips non-India Beckman results and continues pagination until it finds India jobs', async () => {
  const beckman = await loadBeckmanModule()
  assert.ok(beckman)

  const requestedUrls = []
  const jobs = await beckman.run({
    maxPages: 2,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === beckman.buildSearchResultsPageUrl()) {
        return readFixture('search-results-page-0.html')
      }
      if (url === beckman.buildSearchResultsPageUrl(10)) {
        return readFixture('search-results-page-1.html')
      }
      if (url === 'https://jobs.danaher.com/global/en/job/R1310882/Lead-software-Engineer') {
        return readFixture('job-detail-R1310882.html')
      }
      throw new Error(`Unexpected Beckman fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    beckman.buildSearchResultsPageUrl(),
    beckman.buildSearchResultsPageUrl(10),
    'https://jobs.danaher.com/global/en/job/R1310882/Lead-software-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Beckman Coulter Diagnostics')
  assert.equal(jobs[0].source, 'beckmancoulterdiagnostics')
  assert.equal(jobs[0].jobId, 'R1310882')
  assert.match(jobs[0].location, /India/)
  assert.equal(
    jobs[0].applyUrl,
    'https://danaher.wd1.myworkdayjobs.com/DanaherJobs/job/Bangalore-Karnataka-India/Lead-software-Engineer_R1310882/apply',
  )
})
