import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'mongodb',
)

const readFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const provider = {
  source: 'mongodb',
  companyName: 'MongoDB',
  companyCareerPage: 'https://www.mongodb.com/company/careers/see-jobs',
  countryFilter: 'India',
  atsPlatform: 'greenhouse',
  config: {
    discovery: {
      careerPageUrl: 'https://www.mongodb.com/company/careers/see-jobs',
      listingApiUrl: 'https://boards-api.greenhouse.io/v1/boards/mongodb/jobs',
    },
    request: {
      method: 'GET',
      query: {
        content: 'true',
      },
    },
    pagination: {
      strategy: 'single-page',
      resultsPath: 'jobs',
      hasMorePath: 'hasMore',
    },
    mapping: {
      title: 'title',
      location: 'location.name',
      jobId: 'id',
      requisitionId: 'requisition_id',
      applyUrl: 'absolute_url',
      department: 'departments.0.name',
      employmentType: {
        path: 'metadata',
        find: { key: 'name', value: 'Employment Type' },
        valuePath: 'value',
      },
      jobDescription: 'content',
      postingDate: 'first_published',
    },
    resultFilter: {
      include: [
        {
          field: 'location',
          pattern: 'india|bengaluru|bangalore|gurugram|gurgaon|mumbai|pune|hyderabad|chennai|noida',
        },
      ],
    },
  },
}

test('runApiPortalScraper maps MongoDB Greenhouse jobs and keeps only India roles', async () => {
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => readFixture('greenhouse-jobs.json'),
  })

  assert.equal(jobs.length, 51)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'known')
  assert.equal(nativePublication.value, '2026-05-04T04:09:40-04:00')
  assert.equal(nativePublication.candidates[0].updated_at, '2026-06-18T15:34:16-04:00')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Account Executive, Acquisition/Growth',
    company: 'MongoDB',
    location: 'Bengaluru; Gurugram; Mumbai',
    city: 'Bengaluru; Gurugram; Mumbai',
    country: 'India',
    link: 'https://www.mongodb.com/careers/job/?gh_jid=7870623',
    applyUrl: 'https://www.mongodb.com/careers/job/?gh_jid=7870623',
    sourceUrl: 'https://www.mongodb.com/careers/job/?gh_jid=7870623',
    source: 'mongodb',
    jobId: 7870623,
    requisitionId: '426253',
    department: 'Sales APAC (India)',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: jobs[0].jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
    postingDate: '2026-05-04T04:09:40-04:00',
  })

  assert.match(jobs[0].jobDescription, /Come to MongoDB and get your Masters in Sales/i)
  assert.match(jobs[0].jobDescription, /&lt;h3&gt;The Opportunity&lt;\/h3&gt;/i)
  assert.ok(jobs.every((job) => /india|bengaluru|bangalore|gurugram|gurgaon|mumbai|pune|hyderabad|chennai|noida/i.test(job.location)))
})

test('runApiPortalScraper keeps MongoDB India roles whose locations use shared India city labels outside the legacy regex', async () => {
  const hydratedProvider = getScraperCatalog().find((entry) => entry.source === 'mongodb')
  assert.ok(hydratedProvider)

  const jobs = await runApiPortalScraper({
    provider: hydratedProvider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 1,
          requisition_id: 'REQ-DELHI',
          title: 'Developer Advocate',
          location: { name: 'Delhi' },
          absolute_url: 'https://www.mongodb.com/careers/job/?gh_jid=1',
          departments: [{ name: 'Engineering' }],
          metadata: [{ name: 'Employment Type', value: 'Full-time' }],
          content: '<p>Delhi role</p>',
          updated_at: '2026-08-18T10:00:00-04:00',
        },
        {
          id: 2,
          requisition_id: 'REQ-TRV',
          title: 'Solutions Architect',
          location: { name: 'Trivandrum' },
          absolute_url: 'https://www.mongodb.com/careers/job/?gh_jid=2',
          departments: [{ name: 'Sales Engineering' }],
          metadata: [{ name: 'Employment Type', value: 'Full-time' }],
          content: '<p>Trivandrum role</p>',
          updated_at: '2026-08-18T10:00:00-04:00',
        },
        {
          id: 3,
          requisition_id: 'REQ-US',
          title: 'Account Executive',
          location: { name: 'New York, United States' },
          absolute_url: 'https://www.mongodb.com/careers/job/?gh_jid=3',
          departments: [{ name: 'Sales' }],
          metadata: [{ name: 'Employment Type', value: 'Full-time' }],
          content: '<p>US role</p>',
          updated_at: '2026-08-18T10:00:00-04:00',
        },
      ],
      hasMore: false,
    }),
  })

  assert.deepEqual(
    jobs.map((job) => ({ title: job.title, location: job.location })),
    [
      { title: 'Developer Advocate', location: 'Delhi' },
      { title: 'Solutions Architect', location: 'Trivandrum' },
    ],
  )
})
