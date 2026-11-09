import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildJobDetailApiUrl,
  buildJobDetailUrl,
  extractJobDetail,
  buildSearchUrl,
  extractSearchResults,
  run,
} from '../../scraper/oracle/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'oracle',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const sampleDetailPayload = {
  Id: '337745',
  Title: 'Senior Principal NetSuite Functional Consultant',
  Category: 'Consulting',
  JobSchedule: 'Full time',
  PostedDate: '2026-06-24',
  PrimaryLocation: 'Hyderabad, Telangana, India',
  PrimaryLocationCountry: 'IN',
  ExternalDescriptionStr: '<p>Lead complex NetSuite ERP transformation programs across finance and supply chain.</p>',
  ExternalQualificationsStr: '<ul><li>10+ years of consulting and implementation experience</li><li>Bachelor degree in Engineering or related field</li></ul>',
}

test('buildSearchUrl keeps Oracle searches on the public Oracle Cloud careers finder with India scoping', () => {
  assert.equal(
    buildSearchUrl(),
    'https://eeho.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_45001,limit=24,offset=0,location=India',
  )
  assert.equal(
    buildSearchUrl({ page: 2, limit: 10, location: 'Bengaluru, India' }),
    'https://eeho.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_45001,limit=10,offset=20,location=Bengaluru, India',
  )
})

test('buildJobDetailUrl keeps Oracle detail links on the public careers route', () => {
  assert.equal(
    buildJobDetailUrl('337745'),
    'https://careers.oracle.com/en/sites/jobsearch/job/337745/',
  )
})

test('buildJobDetailApiUrl uses the official Oracle detail endpoint', () => {
  assert.equal(
    buildJobDetailApiUrl('337745'),
    'https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails/337745?expand=all',
  )
})

test('extractSearchResults normalizes Oracle Cloud requisitions and keeps only India jobs', () => {
  const payload = readJsonFixture('search-results.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Principal NetSuite Functional Consultant',
    company: 'Oracle',
    department: 'Consulting',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '337745',
    requisitionId: '337745',
    sourceUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337745/',
    applyUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337745/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: 'Bachelor degree in Engineering or related field',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-24',
    closingDate: null,
    jobDescription:
      'Senior Principal Consultant - NetSuite ERP Implementation (Industrial Equipments) Lead global ERP transformation programs across finance, supply chain, inventory, procurement, and order management.',
  })
})

test('extractJobDetail derives experience from Oracle detail qualifications', () => {
  const listing = extractSearchResults(readJsonFixture('search-results.json'))[0]
  const detail = extractJobDetail(sampleDetailPayload, listing)

  assert.deepEqual(detail, {
    title: 'Senior Principal NetSuite Functional Consultant',
    company: 'Oracle',
    department: 'Consulting',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '337745',
    requisitionId: '337745',
    sourceUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337745/',
    applyUrl: 'https://careers.oracle.com/en/sites/jobsearch/job/337745/',
    employmentType: 'Full time',
    experienceRequired: '10+ years',
    minimumQualification: '10+ years of consulting and implementation experience Bachelor degree in Engineering or related field',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-24',
    closingDate: null,
    jobDescription: 'Lead complex NetSuite ERP transformation programs across finance and supply chain. 10+ years of consulting and implementation experience Bachelor degree in Engineering or related field',
  })
})

test('run paginates Oracle Cloud pages, hydrates detail, and decorates shared runner fields', async () => {
  const requests = []
  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    fetchImpl: async (url) => {
      requests.push(url)
      if (url === buildSearchUrl()) {
        return {
          ok: true,
          json: async () => readJsonFixture('search-results.json'),
        }
      }
      if (url === buildJobDetailApiUrl('337745')) {
        return {
          ok: true,
          json: async () => sampleDetailPayload,
        }
      }
      assert.fail(`Unexpected Oracle fetch URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchUrl(),
    buildJobDetailApiUrl('337745'),
    buildSearchUrl(),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'oracle')
  assert.equal(jobs[0].company, 'Oracle')
  assert.equal(jobs[0].jobId, '337745')
  assert.equal(jobs[0].experienceRequired, '10+ years')
  assert.equal(jobs[0].applyUrl, 'https://careers.oracle.com/en/sites/jobsearch/job/337745/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
