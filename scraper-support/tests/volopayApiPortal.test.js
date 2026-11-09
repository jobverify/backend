import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const listingsPayload = [
  {
    id: 'india-1',
    title: 'Senior RoR Developer',
    locations: [
      { name: 'Bengaluru, India' },
    ],
    department: { name: 'Engineering' },
    employmentType: 'Full-time',
    createdAt: '2026-07-09T09:00:00.000Z',
  },
  {
    id: 'ph-1',
    title: 'Finance Associate',
    locations: [
      { name: 'Manila, Philippines' },
    ],
    department: { name: 'Finance' },
    employmentType: 'Full-time',
    createdAt: '2026-07-08T09:00:00.000Z',
  },
]

const detailPayload = {
  id: 'india-1',
  description: 'Build backend payroll and spend-management features.',
  location: null,
}

const overseasDetailPayload = {
  id: 'ph-1',
  description: 'Support finance operations in Manila.',
  location: null,
}

test('runApiPortalScraper maps Volopay Dover jobs and filters to India locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'volopay')
  assert.ok(provider)

  const requested = []
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url, options = {}) => {
      requested.push({ url, options })
      if (url === 'https://app.dover.com/api/v1/careers-page/ebed3959-fa8a-4719-b143-0730e1223ec8/jobs') {
        assert.equal(options.method, 'GET')
        assert.equal(options.body, undefined)
        return { results: listingsPayload }
      }
      if (url === 'https://app.dover.com/api/v1/inbound/application-portal-job/india-1') {
        assert.equal(options.method, 'GET')
        return detailPayload
      }
      if (url === 'https://app.dover.com/api/v1/inbound/application-portal-job/ph-1') {
        assert.equal(options.method, 'GET')
        return overseasDetailPayload
      }
      throw new Error(`Unexpected Volopay API URL: ${url}`)
    },
  })

  assert.deepEqual(
    requested.map((entry) => entry.url),
    [
      'https://app.dover.com/api/v1/careers-page/ebed3959-fa8a-4719-b143-0730e1223ec8/jobs',
      'https://app.dover.com/api/v1/inbound/application-portal-job/india-1',
      'https://app.dover.com/api/v1/inbound/application-portal-job/ph-1',
    ],
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior RoR Developer',
    company: 'Volopay',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://app.dover.com/apply/volopay/india-1',
    applyUrl: 'https://app.dover.com/apply/volopay/india-1',
    sourceUrl: 'https://app.dover.com/apply/volopay/india-1',
    source: 'volopay',
    jobId: 'india-1',
    requisitionId: 'india-1',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: '2026-07-09T09:00:00.000Z',
    jobDescription: 'Build backend payroll and spend-management features.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
