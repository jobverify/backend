import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractSearchResults,
} from '../../scraper/nokia/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'nokia',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps Nokia searches on the public Oracle Cloud careers finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://fa-evmr-saasfaprod1.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10, location: 'Bengaluru, India' }),
    'https://fa-evmr-saasfaprod1.fa.ocs.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=Bengaluru, India',
  )
})

test('buildJobDetailUrl keeps Nokia detail links on the public careers route', () => {
  assert.equal(
    buildJobDetailUrl('31228'),
    'https://jobs.nokia.com/en/sites/CX_1/job/31228',
  )
})

test('extractSearchResults normalizes Nokia Oracle Cloud requisitions and keeps only India jobs', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Lead',
    company: 'Nokia',
    department: null,
    location: 'India',
    city: null,
    jobId: '31228',
    requisitionId: '31228',
    sourceUrl: 'https://jobs.nokia.com/en/sites/CX_1/job/31228',
    applyUrl: 'https://jobs.nokia.com/en/sites/CX_1/job/31228',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-26',
    closingDate: null,
    jobDescription:
      'This opening is for Core Wifi SW developers having experience in embedded SW development in Linux environment.',
  })
})
