import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractSearchResults,
} from '../../scraper/akamai/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'akamai',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps Akamai searches on the public Oracle Cloud careers finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://fa-extu-saasfaprod1.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10, location: 'Bangalore, India' }),
    'https://fa-extu-saasfaprod1.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=Bangalore, India',
  )
})

test('buildJobDetailUrl keeps Akamai detail links on the public jobs.akamai.com route', () => {
  assert.equal(
    buildJobDetailUrl('2114'),
    'https://jobs.akamai.com/en/sites/CX_1/job/2114',
  )
})

test('extractSearchResults normalizes Akamai Oracle Cloud requisitions and keeps only India jobs', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Development Engineer in Test II',
    company: 'Akamai',
    department: null,
    location: 'India',
    city: 'India',
    jobId: '2114',
    requisitionId: '2114',
    sourceUrl: 'https://jobs.akamai.com/en/sites/CX_1/job/2114',
    applyUrl: 'https://jobs.akamai.com/en/sites/CX_1/job/2114',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-25',
    closingDate: null,
    jobDescription: 'The Software Development Engineer in Test II ensures software quality through designing, implementing, and maintaining automated testing systems and processes.',
  })
})
