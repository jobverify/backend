import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL,
  RADWARE_TALEO_JOBLIST_URL,
  buildJobDetailUrl,
  createRadwareScraper,
  extractJobDetail,
  extractSearchResults,
} from '../../scraper/radware/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'radware',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('Radware constants stay pinned to the verified official careers handoff and Taleo board', () => {
  assert.equal(CAREERS_URL, 'https://www.radware.com/careers/')
  assert.equal(RADWARE_TALEO_JOBLIST_URL, 'https://radware.taleo.net/careersection/ex/joblist.ftl')
  assert.equal(
    buildJobDetailUrl('2600003L'),
    'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
  )
})

test('extractSearchResults keeps only explicit India jobs from the public Radware Taleo listing payload', () => {
  const jobs = extractSearchResults(readFixture('joblist.html'))

  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Centre - Ops Engineer',
      location: 'IN-IN-Chennai',
      jobId: '2600003L',
      applyUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
      postingDate: '2026-04-28',
      employmentType: 'Full-time',
    },
  ])
})

test('extractJobDetail reads the public Radware Taleo detail payload and normalizes shared job fields', () => {
  const detail = extractJobDetail(
    readFixture('job-detail-2600003L.html'),
    {
      title: 'Senior Data Centre - Ops Engineer',
      location: 'IN-IN-Chennai',
      jobId: '2600003L',
      applyUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
      postingDate: '2026-04-28',
      employmentType: 'Full-time',
    },
  )

  assert.deepEqual(detail, {
    title: 'Senior Data Centre - Ops Engineer',
    company: 'Radware',
    department: 'Internet/Network Operations',
    location: 'IN-IN-Chennai',
    city: 'Chennai',
    country: 'India',
    jobId: '2600003L',
    requisitionId: '2600003L',
    sourceUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
    applyUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-28',
    closingDate: null,
    jobDescription: 'What is the job? The Cloud DCOps Engineer will join the Radware Cloud Division. Deploy and operate data center and cloud infrastructure solutions. What you need? 4+ years of industry-relevant experience. Deep knowledge of Juniper routers and switches.',
  })
})

test('run follows the public Radware Taleo board and returns decorated India jobs', async () => {
  const requestedUrls = []
  const scraper = createRadwareScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === RADWARE_TALEO_JOBLIST_URL) return readFixture('joblist.html')
      if (url === 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en') {
        return readFixture('job-detail-2600003L.html')
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T05:30:00.000Z',
  })

  const jobs = await scraper.run()

  assert.deepEqual(requestedUrls, [
    RADWARE_TALEO_JOBLIST_URL,
    'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Centre - Ops Engineer',
      company: 'Radware',
      department: 'Internet/Network Operations',
      location: 'IN-IN-Chennai',
      city: 'Chennai',
      country: 'India',
      jobId: '2600003L',
      requisitionId: '2600003L',
      sourceUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
      applyUrl: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-04-28',
      closingDate: null,
      jobDescription: 'What is the job? The Cloud DCOps Engineer will join the Radware Cloud Division. Deploy and operate data center and cloud infrastructure solutions. What you need? 4+ years of industry-relevant experience. Deep knowledge of Juniper routers and switches.',
      source: 'radware',
      link: 'https://radware.taleo.net/careersection/ex/jobdetail.ftl?job=2600003L&lang=en',
      scrapedAt: '2026-07-11T05:30:00.000Z',
    },
  ])
})
