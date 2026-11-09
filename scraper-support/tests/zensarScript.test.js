import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/zensar/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'zensar',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps Zensar searches on the public Oracle Cloud careers finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10, location: 'Mumbai, Maharashtra, India' }),
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=Mumbai, Maharashtra, India',
  )
})

test('buildJobDetailUrl keeps Zensar detail links on the public Oracle careers route', () => {
  assert.equal(
    buildJobDetailUrl('145939'),
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
  )
})

test('extractSearchResults normalizes Zensar Oracle Cloud requisitions and keeps only India jobs', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'SAP AMS FICO Consultant - Mumbai',
    company: 'Zensar',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '145939',
    requisitionId: '145939',
    sourceUrl: 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
    applyUrl: 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-27',
    closingDate: null,
    jobDescription: 'SAP FICO Consultant – AMS Support (Zensar) Experience: 9–12 Years Engagement: Application Management Services (AMS) Location: Mumbai / India (Global Delivery Model)',
  })
})

test('extractPaginationSummary reads Zensar next-page availability from the Oracle Cloud payload', () => {
  const payload = readJsonFixture('search-results.json')

  assert.deepEqual(extractPaginationSummary(payload, { page: 0 }), {
    hasNext: true,
    pageSize: 24,
    nextOffset: 24,
    totalCount: 517,
  })
})

test('extractJobDetail reads Zensar detail metadata, experience, and HTML descriptions', () => {
  const payload = readJsonFixture('job-detail-145939.json')
  const detail = extractJobDetail(payload, {
    title: 'SAP AMS FICO Consultant - Mumbai',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '145939',
    requisitionId: '145939',
    sourceUrl: 'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
  })

  assert.equal(detail.title, 'SAP AMS FICO Consultant - Mumbai')
  assert.equal(detail.department, null)
  assert.equal(detail.location, 'Mumbai, Maharashtra, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.jobId, '145939')
  assert.equal(detail.requisitionId, '145939')
  assert.equal(detail.employmentType, 'Professional (Lateral, Experienced, Subcon Hiring)')
  assert.equal(detail.experienceRequired, '9-12 years')
  assert.equal(detail.minimumQualification, null)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-06-27')
  assert.equal(detail.closingDate, '2026-07-14')
  assert.equal(
    detail.applyUrl,
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
  )
  assert.equal(
    detail.sourceUrl,
    'https://fa-etvl-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/145939',
  )
  assert.match(detail.jobDescription, /Role Overview/i)
  assert.match(detail.jobDescription, /SAP FICO Consultant/i)
  assert.match(detail.jobDescription, /L2\/L3 production support/i)
  assert.match(detail.jobDescription, /SLA & KPI adherence/i)
})
