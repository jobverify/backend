import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchResultsPageUrl,
  extractJobDetail,
  extractSearchPayload,
  extractSearchResults,
} from '../../scraper/questglobal/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'questglobal',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Quest Global listings on the official offset route', () => {
  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.quest-global.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(1000),
    'https://careers.quest-global.com/global/en/search-results?from=1000',
  )
})

test('extractSearchPayload pulls the embedded Phenom search payload and India aggregation from the official listing page', () => {
  const html = readFixture('search-results-page-0.html')
  const payload = extractSearchPayload(html)

  assert.equal(payload.widgetApiEndpoint, 'https://careers.quest-global.com/widgets')
  assert.equal(payload.totalHits, 1522)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 1003)
  assert.equal(payload.jobs[0].reqId, 'P-118996')
})

test('extractSearchResults normalizes Quest Global listing cards and employment types from embedded search jobs', () => {
  const html = readFixture('search-results-page-0.html')
  const jobs = extractSearchResults(extractSearchPayload(html))
  const leadEngineer = jobs.find((job) => job.jobId === 'P-118996')
  const swTestEngineer = jobs.find((job) => job.jobId === 'P-114377')

  assert.deepEqual({ ...leadEngineer, requiredSkills: [] }, {
    title: 'Lead Engineer - ATE LAB Equipment',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'P-118996',
    requisitionId: 'P-118996',
    department: 'Semiconductors',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Embrace the role of a Lead Engineer - ATE Lab Equipment and drive the reliability and efficiency of advanced test equipment. Leverage your expertise in ATE testers, troubleshooting, and semiconductor testing to support high-volume production and continuous improvement. Collaborate with cross-functional teams and make a significant impact in a dynamic lab environment.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-21T09:20:20.188+0000',
    applyUrl: null,
    sourceUrl: 'https://careers.quest-global.com/global/en/job/P-118996/Lead-Engineer-ATE-LAB-Equipment',
  })
  assert.ok(leadEngineer.requiredSkills.includes('wafer probers'))

  assert.equal(swTestEngineer.employmentType, 'Contract')
  assert.equal(swTestEngineer.country, 'India')
  assert.equal(
    swTestEngineer.sourceUrl,
    'https://careers.quest-global.com/global/en/job/P-114377/Sw-Test-Engineer',
  )
})

test('extractSearchResults preserves mixed-country jobs on later Quest Global offsets so the runner can filter India explicitly', () => {
  const html = readFixture('search-results-page-1000.html')
  const jobs = extractSearchResults(extractSearchPayload(html))
  const indiaJob = jobs.find((job) => job.jobId === 'P-115955')
  const uaeJob = jobs.find((job) => job.jobId === 'P-113313')

  assert.equal(indiaJob.country, 'India')
  assert.equal(uaeJob.country, 'United Arab Emirates')
  assert.equal(
    uaeJob.sourceUrl,
    'https://careers.quest-global.com/global/en/job/P-113313/Controls-DCS-Dubai',
  )
})

test('extractJobDetail reads Quest Global job detail metadata, skills, and experience from the official detail page', () => {
  const html = readFixture('job-detail-P-118996.html')
  const detail = extractJobDetail(html, {
    title: 'Lead Engineer - ATE LAB Equipment',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'P-118996',
    requisitionId: 'P-118996',
    department: 'Semiconductors',
    sourceUrl: 'https://careers.quest-global.com/global/en/job/P-118996/Lead-Engineer-ATE-LAB-Equipment',
  })

  assert.equal(detail.title, 'Lead Engineer - ATE LAB Equipment')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'P-118996')
  assert.equal(detail.requisitionId, 'P-118996')
  assert.equal(detail.department, 'Semiconductors')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '8+ years')
  assert.equal(
    detail.minimumQualification,
    'Bachelor’s degree in Electronics / Electrical / Instrumentation Engineering.',
  )
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-05-28')
  assert.equal(
    detail.applyUrl,
    'https://careers.quest-global.com/global/en/job/P-118996/Lead-Engineer-ATE-LAB-Equipment',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.quest-global.com/global/en/job/P-118996/Lead-Engineer-ATE-LAB-Equipment',
  )
  assert.match(detail.jobDescription, /ATE Lab Equipment Lead Engineer/i)
  assert.ok(
    detail.requiredSkills.some((skill) => /ATE testers \(Advantest \/ Teradyne or similar\)/i.test(skill)),
  )
})
