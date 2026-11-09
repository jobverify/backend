import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../apiPortal/engine.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'qualcomm',
)

const readJsonFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const buildSearchFixture = () => {
  const payload = readJsonFixture('search-india-start-0.json')
  return {
    ...payload,
    data: {
      ...payload.data,
      positions: payload.data.positions.slice(0, 2),
      count: 2,
    },
  }
}

const provider = {
  source: 'qualcomm',
  companyName: 'Qualcomm',
  companyCareerPage: 'https://careers.qualcomm.com/careers',
  countryFilter: 'India',
  atsPlatform: 'eightfold',
  config: {
    discovery: {
      careerPageUrl: 'https://careers.qualcomm.com/careers',
      listingApiUrl: 'https://careers.qualcomm.com/api/pcsx/search',
    },
    request: {
      method: 'GET',
      query: {
        domain: 'qualcomm.com',
        query: '',
        location: 'India',
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: 10,
      offsetParam: 'start',
      limitParam: 'limit',
      resultsPath: 'data.positions',
      totalCountPath: 'data.count',
    },
    mapping: {
      title: 'name',
      location: 'locations.0',
      jobId: 'id',
      requisitionId: 'displayJobId',
      sourceUrl: 'positionUrl',
      applyUrl: 'positionUrl',
      department: 'department',
      postingDate: 'postedTs',
    },
    detail: {
      enabled: true,
      urlTemplate: 'https://careers.qualcomm.com/api/pcsx/position_details?position_id={{jobId}}&domain=qualcomm.com&hl=en',
      method: 'GET',
      mapping: {
        jobDescription: 'data.jobDescription',
      },
    },
  },
}

test('runApiPortalScraper maps Qualcomm Eightfold jobs and stops from total count pagination metadata', async () => {
  const searchPayload = buildSearchFixture()
  const firstDetail = readJsonFixture('position-446718927484.json')
  const secondDetail = {
    ...firstDetail,
    data: {
      ...firstDetail.data,
      id: 446718942593,
      displayJobId: '3092653',
      name: 'Senior Engineer - Linux Kernel Development',
      locations: ['Hyderabad, Telangana, India'],
      department: 'Software Engineering',
      publicUrl: 'https://careers.qualcomm.com/careers/job/446718942593',
      jobDescription: '<p>Build and optimize Linux kernel features for Qualcomm platforms.</p>',
      positionUrl: '/careers/job/446718942593',
    },
  }

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) return searchPayload
      if (url.includes('position_id=446718927484')) return firstDetail
      if (url.includes('position_id=446718942593')) return secondDetail
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Senior Engineer - Camera Firmware')
  assert.equal(jobs[0].company, 'Qualcomm')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'https://careers.qualcomm.com/careers/job/446718927484')
  assert.equal(jobs[0].applyUrl, 'https://careers.qualcomm.com/careers/job/446718927484')
  assert.equal(jobs[0].sourceUrl, 'https://careers.qualcomm.com/careers/job/446718927484')
  assert.equal(jobs[0].source, 'qualcomm')
  assert.equal(jobs[0].jobId, 446718927484)
  assert.equal(jobs[0].requisitionId, '3092661')
  assert.equal(jobs[0].department, 'Systems Engineering')
  assert.equal(jobs[0].employmentType, null)
  assert.equal(jobs[0].experienceRequired, null)
  assert.equal(jobs[0].minimumQualification, null)
  assert.equal(jobs[0].preferredQualification, null)
  assert.deepEqual(jobs[0].requiredSkills, [])
  assert.equal(jobs[0].remoteStatus, 'On-site')
  assert.equal(jobs[0].postingDate, 1781481600)
  assert.match(jobs[0].jobDescription, /Camera Firmware/i)
  assert.equal(jobs[1].title, 'Senior Engineer - Linux Kernel Development')
  assert.equal(jobs[1].department, 'Software Engineering')
})
