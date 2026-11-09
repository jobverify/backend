import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/arm/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'arm',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Arm listings on the public India location filter route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://careers.arm.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://careers.arm.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})

test('extractSearchResults keeps India jobs from Arm listing pages and maps category into department', () => {
  const html = readFixture('search-india-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Verification Engineer',
    company: 'Arm',
    department: 'Hardware Engineering, Verification',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    jobId: '92870409072',
    requisitionId: '92870409072',
    sourceUrl: 'https://careers.arm.com/job/bengaluru/verification-engineer/33099/92870409072',
    applyUrl: 'https://careers.arm.com/job/bengaluru/verification-engineer/33099/92870409072',
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

test('extractPaginationSummary reads Arm result counts and next-page availability from the public page', () => {
  const html = readFixture('search-india-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    currentPage: 1,
    totalPages: 4,
    totalJobCount: 46,
  })
})
