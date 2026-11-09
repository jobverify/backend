import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailUrl,
  buildSearchUrl,
  createUberScraper,
  extractSearchResults,
} from '../../scraper/uber/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'uber',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps Uber requests on the official India Oracle Cloud finder', () => {
  assert.equal(
    buildSearchUrl(),
    'https://iaziqy.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10 }),
    'https://iaziqy.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=India',
  )
})

test('buildJobDetailUrl uses Uber public Oracle Cloud job detail pages', () => {
  assert.equal(
    buildJobDetailUrl('158536'),
    'https://iaziqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/158536',
  )
})

test('extractSearchResults normalizes only Uber requisitions available in India', () => {
  const jobs = extractSearchResults(readJsonFixture('search-results.json'))

  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    jobId: job.jobId,
    sourceUrl: job.sourceUrl,
  })), [
    {
      title: 'Software Engineer II',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: '158536',
      sourceUrl: 'https://iaziqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/158536',
    },
    {
      title: 'Product Manager',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      jobId: '158537',
      sourceUrl: 'https://iaziqy.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/158537',
    },
  ])
})

test('createUberScraper caps returned jobs without calling unofficial surfaces', async () => {
  const payload = readJsonFixture('search-results.json')
  const requests = []
  const jobs = await createUberScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requests.push(url)
      return payload
    },
  }).run()

  assert.deepEqual(requests, [buildSearchUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'uber')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
