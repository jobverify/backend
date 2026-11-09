import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../phenom/engine.js'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(testDir, 'fixtures', 'juniper')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const scraper = createPhenomScraper({
  companyName: 'Juniper Networks',
  source: 'juniper',
  baseUrl: 'https://careers.hpe.com',
  searchPath: '/juniper',
  jobPathPrefix: '/us/en',
  scraperDir: path.join(testDir, '..', 'scraper', 'hpe'),
})

test('buildSearchResultsPageUrl keeps Juniper listings on the official landing-page route', () => {
  assert.equal(
    scraper.buildSearchResultsPageUrl(),
    'https://careers.hpe.com/juniper',
  )
  assert.equal(
    scraper.buildSearchResultsPageUrl(10),
    'https://careers.hpe.com/juniper?from=10',
  )
})

test('extractSearchPayload reads Juniper targetedJobs payloads from the official landing page', () => {
  const payload = scraper.extractSearchPayload(readFixture('search-results-page-0.html'))
  const nextPayload = scraper.extractSearchPayload(readFixture('search-results-page-10.html'))

  assert.equal(payload.widgetApiEndpoint, 'https://careers.hpe.com/widgets')
  assert.equal(payload.totalHits, 340)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.jobs[0].reqId, '1191918')
  assert.equal(nextPayload.jobs[0].reqId, '1198597')
})

test('extractSearchResults normalizes Juniper landing-page listings into Phenom job cards', () => {
  const jobs = scraper.extractSearchResults(
    scraper.extractSearchPayload(readFixture('search-results-page-0.html')),
  )
  const firstIndiaJob = jobs.find((job) => job.jobId === '1191918')

  assert.deepEqual({ ...firstIndiaJob, requiredSkills: [] }, {
    title: 'Software Engineer Staff',
    location: 'Bengaluru, Karnātaka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1191918',
    requisitionId: '1191918',
    department: 'Engineering & QA',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Join our team as a Senior Software Engineer Staff and drive innovation in cloud and networking solutions. Leverage your expertise in C++, C++, and Python to design, develop, and troubleshoot complex software systems. Collaborate with cross-functional teams and play a key role in delivering high-quality, scalable solutions for global clients.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-12-10T00:00:00.000+0000',
    applyUrl: 'https://hpe.wd5.myworkdayjobs.com/Jobsathpe/job/Bengaluru-Karntaka-India/Software-Engineer-Staff_1191918-2/apply',
    sourceUrl: 'https://careers.hpe.com/us/en/job/1191918/Software-Engineer-Staff',
  })
  assert.ok(firstIndiaJob.requiredSkills.includes('networking'))
})

test('extractJobDetail reads Juniper detail metadata and Workday apply links from the official job page', () => {
  const detail = scraper.extractJobDetail(readFixture('job-detail-1191918.html'), {
    title: 'Software Engineer Staff',
    location: 'Bengaluru, Karnātaka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '1191918',
    requisitionId: '1191918',
    department: 'Engineering & QA',
    sourceUrl: 'https://careers.hpe.com/us/en/job/1191918/Software-Engineer-Staff',
  })

  assert.equal(detail.title, 'Software Engineer Staff')
  assert.match(detail.location, /^Bengaluru, Karn.*taka, India$/i)
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '1191918')
  assert.equal(detail.requisitionId, '1191918')
  assert.equal(detail.department, 'Engineering & QA')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '10+ years')
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-05-17')
  assert.equal(
    detail.applyUrl,
    'https://hpe.wd5.myworkdayjobs.com/Jobsathpe/job/Bengaluru-Karntaka-India/Software-Engineer-Staff_1191918-2/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.hpe.com/us/en/job/1191918/Software-Engineer-Staff',
  )
  assert.match(detail.jobDescription, /What you’ll do/i)
  assert.ok(detail.requiredSkills.includes('c++ programming'))
})

test('run keeps Juniper India jobs from the landing-page payload and enriches them from detail pages', async () => {
  const jobs = await scraper.run({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      if (url === 'https://careers.hpe.com/juniper') {
        return readFixture('search-results-page-0.html')
      }
      if (url === 'https://careers.hpe.com/us/en/job/1191918/Software-Engineer-Staff') {
        return readFixture('job-detail-1191918.html')
      }
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Juniper Networks')
  assert.equal(jobs[0].source, 'juniper')
  assert.equal(jobs[0].jobId, '1191918')
  assert.match(jobs[0].location, /^Bengaluru, Karn.*taka, India$/i)
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].applyUrl,
    'https://hpe.wd5.myworkdayjobs.com/Jobsathpe/job/Bengaluru-Karntaka-India/Software-Engineer-Staff_1191918-2/apply',
  )
})
