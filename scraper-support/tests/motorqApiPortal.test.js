import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const listingsPayload = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      id: 'india-1',
      title: 'Senior Software Engineer',
      locations: [
        { name: 'Bengaluru, India' },
      ],
      workplace_type: 'HYBRID',
      is_published: true,
    },
    {
      id: 'us-1',
      title: 'Account Executive',
      locations: [
        { name: 'United States' },
      ],
      workplace_type: 'REMOTE',
      is_published: true,
    },
  ],
}

const indiaDetailPayload = {
  id: 'india-1',
  user_provided_description: 'Build connected-vehicle platform integrations.',
  compensation: {
    employment_type: 'FULL_TIME',
  },
  created: '2026-07-09T09:00:00.000Z',
}

const usDetailPayload = {
  id: 'us-1',
  user_provided_description: 'Drive new business across the United States.',
  compensation: {
    employment_type: 'FULL_TIME',
  },
  created: '2026-07-08T09:00:00.000Z',
}

test('runApiPortalScraper maps Motorq Dover jobs and filters to India locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'motorq')
  assert.ok(provider)

  const requested = []
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url, options = {}) => {
      requested.push({ url, options })
      if (url === 'https://app.dover.com/api/v1/careers-page/9e8e642f-e978-454c-b55c-910215742ec7/jobs') {
        assert.equal(options.method, 'GET')
        assert.equal(options.body, undefined)
        return listingsPayload
      }
      if (url === 'https://app.dover.com/api/v1/inbound/application-portal-job/india-1') {
        assert.equal(options.method, 'GET')
        return indiaDetailPayload
      }
      if (url === 'https://app.dover.com/api/v1/inbound/application-portal-job/us-1') {
        assert.equal(options.method, 'GET')
        return usDetailPayload
      }
      throw new Error(`Unexpected Motorq API URL: ${url}`)
    },
  })

  assert.deepEqual(
    requested.map((entry) => entry.url),
    [
      'https://app.dover.com/api/v1/careers-page/9e8e642f-e978-454c-b55c-910215742ec7/jobs',
      'https://app.dover.com/api/v1/inbound/application-portal-job/india-1',
      'https://app.dover.com/api/v1/inbound/application-portal-job/us-1',
    ],
  )

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Motorq',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://app.dover.com/apply/motorq/india-1',
    applyUrl: 'https://app.dover.com/apply/motorq/india-1',
    sourceUrl: 'https://app.dover.com/apply/motorq/india-1',
    source: 'motorq',
    jobId: 'india-1',
    requisitionId: 'india-1',
    department: null,
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: '2026-07-09T09:00:00.000Z',
    jobDescription: 'Build connected-vehicle platform integrations.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'Hybrid',
    scrapedAt: jobs[0].scrapedAt,
  })
})
