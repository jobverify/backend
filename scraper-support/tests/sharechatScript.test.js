import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobUrl,
  buildSearchUrl,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/sharechat/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sharechat',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps ShareChat listings on the public first-party careers API', () => {
  assert.equal(
    buildSearchUrl(),
    'https://sharechat.com/api/careersList?limit=100',
  )
  assert.equal(
    buildSearchUrl({ limit: 50, offsetToken: 'next-token' }),
    'https://sharechat.com/api/careersList?limit=50&offsetToken=next-token',
  )
})

test('buildJobUrl creates ShareChat job links on the public MyNextHire route', () => {
  assert.equal(
    buildJobUrl(2390),
    'https://sharechat.mynexthire.com/employer/jobs?src=careers&p=eyJwYWdlVHlwZSI6ImpkIiwiY3ZTb3VyY2UiOiJjYXJlZXJzIiwicmVxSWQiOjIzOTAsInJlcXVlc3RlciI6eyJpZCI6IiIsImNvZGUiOiIiLCJuYW1lIjoiIn0sInBhZ2UiOiJjYXJlZXJzIiwiYnVmaWx0ZXIiOi0xLCJjdXN0b21GaWVsZHMiOnt9fQ==',
  )
})

test('extractSearchResults flattens ShareChat careers groups into normalized jobs', () => {
  const payload = readJsonFixture('careers-list-page-1.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Video Editor- AI',
    company: 'ShareChat',
    department: 'Content & Operations',
    location: 'India',
    city: null,
    jobId: '2390',
    requisitionId: '2390',
    sourceUrl: 'https://sharechat.mynexthire.com/employer/jobs?src=careers&p=eyJwYWdlVHlwZSI6ImpkIiwiY3ZTb3VyY2UiOiJjYXJlZXJzIiwicmVxSWQiOjIzOTAsInJlcXVlc3RlciI6eyJpZCI6IiIsImNvZGUiOiIiLCJuYW1lIjoiIn0sInBhZ2UiOiJjYXJlZXJzIiwiYnVmaWx0ZXIiOi0xLCJjdXN0b21GaWVsZHMiOnt9fQ==',
    applyUrl: 'https://sharechat.mynexthire.com/employer/jobs?src=careers&p=eyJwYWdlVHlwZSI6ImpkIiwiY3ZTb3VyY2UiOiJjYXJlZXJzIiwicmVxSWQiOjIzOTAsInJlcXVlc3RlciI6eyJpZCI6IiIsImNvZGUiOiIiLCJuYW1lIjoiIn0sInBhZ2UiOiJjYXJlZXJzIiwiYnVmaWx0ZXIiOi0xLCJjdXN0b21GaWVsZHMiOnt9fQ==',
    employmentType: 'Contract',
    experienceRequired: '3-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null
  })
  assert.deepEqual(jobs[2], {
    title: 'Intern - Video Editor',
    company: 'ShareChat',
    department: 'Marketing',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '2371',
    requisitionId: '2371',
    sourceUrl: 'https://sharechat.mynexthire.com/employer/jobs?src=careers&p=eyJwYWdlVHlwZSI6ImpkIiwiY3ZTb3VyY2UiOiJjYXJlZXJzIiwicmVxSWQiOjIzNzEsInJlcXVlc3RlciI6eyJpZCI6IiIsImNvZGUiOiIiLCJuYW1lIjoiIn0sInBhZ2UiOiJjYXJlZXJzIiwiYnVmaWx0ZXIiOi0xLCJjdXN0b21GaWVsZHMiOnt9fQ==',
    applyUrl: 'https://sharechat.mynexthire.com/employer/jobs?src=careers&p=eyJwYWdlVHlwZSI6ImpkIiwiY3ZTb3VyY2UiOiJjYXJlZXJzIiwicmVxSWQiOjIzNzEsInJlcXVlc3RlciI6eyJpZCI6IiIsImNvZGUiOiIiLCJuYW1lIjoiIn0sInBhZ2UiOiJjYXJlZXJzIiwiYnVmaWx0ZXIiOi0xLCJjdXN0b21GaWVsZHMiOnt9fQ==',
    employmentType: 'Internship',
    experienceRequired: '0-0 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null
  })
})

test('extractPaginationSummary reads ShareChat paging markers from the API payload', () => {
  const payload = readJsonFixture('careers-list-page-1.json')

  assert.deepEqual(extractPaginationSummary(payload), {
    hasNext: false,
    offsetToken: null,
    totalJobCount: 3,
  })
})
