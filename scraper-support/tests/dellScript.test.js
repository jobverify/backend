import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractSearchResults,
} from '../../scraper/dell/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'dell',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps Dell searches on the public Oracle Cloud careers finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://iawmqy.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 3, limit: 10, location: 'Bengaluru, India' }),
    'https://iawmqy.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=10,offset=30,location=Bengaluru, India',
  )
})

test('buildJobDetailUrl keeps Dell detail links on the public jobs.dell.com route', () => {
  assert.equal(
    buildJobDetailUrl('R289964'),
    'https://jobs.dell.com/en/sites/careers/job/R289964/',
  )
})

test('extractSearchResults normalizes Dell Oracle Cloud requisitions and keeps only India jobs', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer',
    company: 'Dell Technologies',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'R289964',
    requisitionId: 'R289964',
    sourceUrl: 'https://jobs.dell.com/en/sites/careers/job/R289964/',
    applyUrl: 'https://jobs.dell.com/en/sites/careers/job/R289964/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-24',
    closingDate: null,
    jobDescription: null,
  })
})
