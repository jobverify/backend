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
} from '../../scraper/cisco/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'cisco',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchResultsPageUrl keeps Cisco listings on the official search route', () => {
  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.cisco.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.cisco.com/global/en/search-results?from=10',
  )
})

test('extractSearchPayload reads Cisco embedded Phenom search payload and India aggregation', () => {
  const html = readFixture('search-results-page-0.html')
  const payload = extractSearchPayload(html)

  assert.equal(payload.totalHits, 983)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 10)
  assert.equal(payload.aggregations.country.India, 229)
  assert.equal(payload.jobs[0].reqId, '2012591')
})

test('extractSearchResults normalizes Cisco listing cards into shared scraper fields', () => {
  const html = readFixture('search-results-page-0.html')
  const jobs = extractSearchResults(extractSearchPayload(html))
  const asicLead = jobs.find((job) => job.jobId === '2012591')

  assert.deepEqual({ ...asicLead, requiredSkills: [] }, {
    title: 'ASIC - Signal and Power Integrity Technical Leader - 10 to 16 Years - Bangalore/Chennai',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '2012591',
    requisitionId: '2012591',
    department: 'Product and Engineering',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription:
      'Exciting opportunity for a seasoned Signal and Power Integrity Technical Leader to drive the design and development of next-gen ASIC packaging at Cisco Silicon One. Lead a high-performing team, shape advanced IC architectures, and collaborate with top experts in high-speed, ultra-high-performance networking. Join us to shape the future of Silicon packaging!',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-06T00:00:00.000+0000',
    applyUrl: 'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/ASIC---Signal-and-Power-Integrity-Technical-Leader---12-to-17-Years---Bangalore-Chennai_2012591/apply',
    sourceUrl: 'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai',
  })

  assert.ok(asicLead.requiredSkills.includes('signal integrity'))
  assert.ok(asicLead.requiredSkills.includes('power integrity'))
})

test('extractJobDetail reads Cisco job detail metadata and workday apply link from the official detail page', () => {
  const html = readFixture('job-detail-2012591.html')
  const detail = extractJobDetail(html, {
    title: 'ASIC - Signal and Power Integrity Technical Leader - 10 to 16 Years - Bangalore/Chennai',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '2012591',
    requisitionId: '2012591',
    department: 'Product and Engineering',
    sourceUrl: 'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai',
  })

  assert.equal(detail.title, 'ASIC - Signal and Power Integrity Technical Leader - 10 to 16 Years - Bangalore/Chennai')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '2012591')
  assert.equal(detail.requisitionId, '2012591')
  assert.equal(detail.department, 'Product and Engineering')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '7+ years')
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-06-03')
  assert.equal(
    detail.applyUrl,
    'https://cisco.wd5.myworkdayjobs.com/Cisco_Careers/job/Bangalore-India/ASIC---Signal-and-Power-Integrity-Technical-Leader---12-to-17-Years---Bangalore-Chennai_2012591/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.cisco.com/global/en/job/2012591/ASIC-Signal-and-Power-Integrity-Technical-Leader-10-to-16-Years-BangaloreChennai',
  )
  assert.match(detail.jobDescription, /Cisco Silicon One/i)
  assert.ok(
    detail.minimumQualification == null
      || /bachelor|degree|engineering/i.test(detail.minimumQualification),
  )
  assert.ok(detail.requiredSkills.includes('signal integrity'))
})
