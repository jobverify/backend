import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/intuit/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'intuit',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Intuit listings on the public search results route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://jobs.intuit.com/location/india-jobs/27595/1269750/2',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://jobs.intuit.com/location/india-jobs/27595/1269750/2/2',
  )
})

test('extractSearchResults keeps only India jobs from Intuit public search pages', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 15)
  assert.deepEqual(jobs[0], {
    title: 'Manager 3, Finance Transformation',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '22448',
    requisitionId: '22448',
    sourceUrl: 'https://jobs.intuit.com/job/bengaluru/manager-3-finance-transformation/27595/96950794544',
  })
  assert.deepEqual(jobs[1], {
    title: 'Staff Database Administrator',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '22405',
    requisitionId: '22405',
    sourceUrl: 'https://jobs.intuit.com/job/bengaluru/staff-database-administrator/27595/96767168592',
  })
})

test('extractPaginationSummary reads Intuit page counts from the public search route', () => {
  const html = readFixture('search-results-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    currentPage: 1,
    totalPages: 2,
    totalJobCount: 26,
    pageSize: 15,
  })
})

test('extractJobDetail reads Intuit detail metadata, Avature apply links, and public HTML description', () => {
  const html = readFixture('job-detail-96950794544.html')
  const detail = extractJobDetail(html, {
    title: 'Manager 3, Finance Transformation',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '22448',
    requisitionId: '22448',
    sourceUrl: 'https://jobs.intuit.com/job/bengaluru/manager-3-finance-transformation/27595/96950794544',
  })

  assert.equal(detail.title, 'Manager 3, Finance Transformation')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '22448')
  assert.equal(detail.requisitionId, '22448')
  assert.equal(detail.department, 'Data')
  assert.equal(detail.employmentType, 'Full-Time')
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-06-26')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://intuit.avature.net/externalCareers/JobApplication?pipelineId=22448',
  )
  assert.equal(
    detail.sourceUrl,
    'https://jobs.intuit.com/job/bengaluru/manager-3-finance-transformation/27595/96950794544',
  )
  assert.match(detail.jobDescription, /About the Role/i)
  assert.match(detail.jobDescription, /Finance Transformation team is seeking a Manager \(M3\)/i)
  assert.match(detail.jobDescription, /Required Qualifications/i)
})
