import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildApplyUrl,
  buildDetailUrl,
  buildSearchRequestPayload,
  extractJobDetail,
  extractSearchResults,
  extractSearchSummary,
  isIndiaListing,
} from '../../scraper/tatatechnologies/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'tatatechnologies',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchRequestPayload keeps Tata Technologies listings on the official RippleHire tokenized endpoint contract', () => {
  assert.deepEqual(buildSearchRequestPayload(), {
    page: 0,
    search: '*:*',
    campaignSeq: '',
    token: 'jjZIWXgr7fPCCF6T5yk4',
    source: 'CAREERSITE',
    pagesize: 10,
  })

  assert.deepEqual(buildSearchRequestPayload(4), {
    page: 4,
    search: '*:*',
    campaignSeq: '',
    token: 'jjZIWXgr7fPCCF6T5yk4',
    source: 'CAREERSITE',
    pagesize: 10,
  })
})

test('isIndiaListing recognizes Tata Technologies India city variants while excluding foreign locations', () => {
  assert.equal(isIndiaListing('PIMPRI'), true)
  assert.equal(isIndiaListing('BANGALORE'), true)
  assert.equal(isIndiaListing('BANGALORE, PUNE'), true)
  assert.equal(isIndiaListing('HALOL BARODA'), true)
  assert.equal(isIndiaListing('Woking'), false)
  assert.equal(isIndiaListing('DETROIT MI'), false)
})

test('extractSearchResults parses Tata Technologies RippleHire XML and filters listings to India roles', () => {
  const xml = readFixture('search-results-page-0.xml')
  const jobs = extractSearchResults(xml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Vehicle Integration',
    location: 'Pimpri, India',
    city: 'Pimpri',
    jobId: '882627',
    requisitionId: '882627',
    sourceUrl: 'https://tatatechnologies.ripplehire.com/candidate/?token=jjZIWXgr7fPCCF6T5yk4&source=CAREERSITE#detail/job/882627',
    applyUrl: 'https://tatatechnologies.ripplehire.com/candidate/?token=jjZIWXgr7fPCCF6T5yk4&source=CAREERSITE#apply/job/882627',
    experienceRequired: '2 - 5 Years',
    postingDate: null,
    department: null,
  })

  assert.deepEqual(jobs[1], {
    title: 'MBD-ASW Developer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '878546',
    requisitionId: '878546',
    sourceUrl: 'https://tatatechnologies.ripplehire.com/candidate/?token=jjZIWXgr7fPCCF6T5yk4&source=CAREERSITE#detail/job/878546',
    applyUrl: 'https://tatatechnologies.ripplehire.com/candidate/?token=jjZIWXgr7fPCCF6T5yk4&source=CAREERSITE#apply/job/878546',
    experienceRequired: '2 - 5 Years',
    postingDate: null,
    department: null,
  })
})

test('extractSearchResults canonicalizes Tata Technologies Bangalore location typos into a stable city name', () => {
  const xml = `
    <JobPageVO>
      <startJobIndex>0</startJobIndex>
      <maxJobSize>10</maxJobSize>
      <totalJobCount>1</totalJobCount>
      <jobVoList>
        <jobVoList>
          <jobSeq>800001</jobSeq>
          <jobTitle>Embedded Software Engineer</jobTitle>
          <jobReqExp>3 - 5 Years</jobReqExp>
          <locations>BANGLORE</locations>
          <jobId>800001</jobId>
        </jobVoList>
      </jobVoList>
    </JobPageVO>
  `

  const jobs = extractSearchResults(xml)

  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].location, 'Bangalore, India')
})

test('extractSearchSummary reads total counts and page offsets from Tata Technologies RippleHire XML', () => {
  const xml = readFixture('search-results-page-0.xml')

  assert.deepEqual(extractSearchSummary(xml), {
    startJobIndex: 0,
    pageSize: 10,
    totalJobCount: 276,
  })
})

test('extractJobDetail pulls Tata Technologies description, posting date, department, and apply URLs from the job detail XML', () => {
  const xml = readFixture('job-detail-878546.xml')
  const detail = extractJobDetail(xml, {
    title: 'MBD-ASW Developer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '878546',
    requisitionId: '878546',
    sourceUrl: buildDetailUrl('878546'),
    applyUrl: buildApplyUrl('878546'),
    experienceRequired: '2 - 5 Years',
  })

  assert.equal(detail.title, 'MBD-ASW Developer')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '878546')
  assert.equal(detail.requisitionId, '878546')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '2 - 5 Years')
  assert.equal(detail.department, 'INDIA')
  assert.match(detail.jobDescription, /MBD Software Developer/i)
  assert.match(detail.jobDescription, /Automotive Powertrain experience/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'MATLAB / Simulink / Stateflow',
    'AUTOSAR Application Layer (CSAR)',
    'MATLAB scripting',
  ])
  assert.equal(detail.postingDate, '27-May-2026')
  assert.equal(detail.closingDate, null)
  assert.equal(detail.applyUrl, buildApplyUrl('878546'))
  assert.equal(detail.sourceUrl, buildDetailUrl('878546'))
})

test('normalizeScrapedJob composes Tata Technologies experienced job types from RippleHire detail payloads', () => {
  const xml = readFixture('job-detail-878546.xml')
  const detail = extractJobDetail(xml, {
    title: 'MBD-ASW Developer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '878546',
    requisitionId: '878546',
    sourceUrl: buildDetailUrl('878546'),
    applyUrl: buildApplyUrl('878546'),
    experienceRequired: '2 - 5 Years',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'tatatechnologies',
    companyName: 'Tata Technologies',
    companyCareerPage: 'https://www.tatatechnologies.com/in/careers/',
    atsPlatform: 'ripplehire',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Junior Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})
