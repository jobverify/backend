import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildSearchUrl,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/netapp/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'netapp',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps NetApp listings on the public India location filter route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://careers.netapp.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(
    buildSearchUrl({ page: 2 }),
    'https://careers.netapp.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D&p=2',
  )
})

test('extractSearchResults keeps India jobs from NetApp listing pages and normalizes mixed-location cards', () => {
  const html = readFixture('search-india-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer (Java / Distributed Systems / Cloud)',
    company: 'NetApp',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '96948243184',
    requisitionId: '96948243184',
    sourceUrl: 'https://careers.netapp.com/job/bengaluru/senior-software-engineer-java-distributed-systems-cloud/27600/96948243184',
    applyUrl: 'https://careers.netapp.com/job/bengaluru/senior-software-engineer-java-distributed-systems-cloud/27600/96948243184',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[1], {
    title: 'Consulting Solutions Architect',
    company: 'NetApp',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '94546315648',
    requisitionId: '94546315648',
    sourceUrl: 'https://careers.netapp.com/job/singapore/consulting-solutions-architect/27600/94546315648',
    applyUrl: 'https://careers.netapp.com/job/singapore/consulting-solutions-architect/27600/94546315648',
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

test('extractPaginationSummary reads NetApp result counts and next-page availability from the public page', () => {
  const html = readFixture('search-india-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: true,
    currentPage: 1,
    totalPages: 6,
    totalJobCount: 76,
  })
})
