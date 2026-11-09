import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/siemens/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'siemens',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Siemens listings on the public externaljobs search route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.siemens.com/en_US/externaljobs/SearchJobs',
  )
  assert.equal(
    buildSearchUrl({ offset: 6 }),
    'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/?folderRecordsPerPage=6&folderOffset=6',
  )
})

test('extractSearchResults keeps only India jobs from Siemens public search pages', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Solution Engineering - Control and Protection Testing',
    company: 'Siemens',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '511056',
    requisitionId: '511056',
    sourceUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
    applyUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('extractPaginationSummary reads Siemens next-page links from the public search results', () => {
  const html = readFixture('search-results-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    nextUrl: 'https://jobs.siemens.com/en_US/externaljobs/SearchJobs/?folderRecordsPerPage=6&folderOffset=6',
  })
})

test('extractJobDetail reads Siemens Avature detail metadata and apply links', () => {
  const html = readFixture('job-detail-511056.html')
  const detail = extractJobDetail(html, {
    title: 'Solution Engineering - Control and Protection Testing',
    company: 'Siemens',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '511056',
    requisitionId: '511056',
    sourceUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
    applyUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
  })

  assert.equal(detail.title, 'Solution Engineering - Control and Protection Testing')
  assert.equal(detail.company, 'Siemens')
  assert.equal(detail.department, 'Engineering')
  assert.equal(detail.location, 'Pune, Maharashtra, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.jobId, '511056')
  assert.equal(detail.requisitionId, '511056')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceLevel, 'Mid-level Professional')
  assert.equal(detail.remoteStatus, 'On-site')
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'Perform analysis and design of single line diagram.',
    'Develop concept of substation relaying & metering diagrams (i.e. A.C. schematic diagrams), and D.C. Schematic for basic design.',
    'Responsible to produce protection and control designs for LVAC, LVDC and UPS equipment associated with LTS.',
  ])
  assert.match(detail.jobDescription, /Protection & Control Engineer is responsible/i)
  assert.equal(
    detail.applyUrl,
    'https://jobs.siemens.com/en_US/externaljobs/ApplicationMethods?folderId=511056',
  )
})

test('normalizeScrapedJob preserves native Siemens employment and experience labels', () => {
  const html = readFixture('job-detail-511056.html')
  const detail = extractJobDetail(html, {
    title: 'Solution Engineering - Control and Protection Testing',
    company: 'Siemens',
    department: 'Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '511056',
    requisitionId: '511056',
    sourceUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
    applyUrl: 'https://jobs.siemens.com/en_US/externaljobs/JobDetail/511056',
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'siemens',
    companyName: 'Siemens Digital Industries Software',
    companyCareerPage: 'https://jobs.siemens.com/en_US/externaljobs/SearchJobs',
    atsPlatform: 'avature',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.experienceLevel, 'Mid-level Professional')
  assert.equal(normalized.jobType, 'Unspecified')
})
