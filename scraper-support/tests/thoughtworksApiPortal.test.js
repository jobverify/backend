import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Thoughtworks Greenhouse jobs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'thoughtworks')
  assert.ok(provider)

  const listingsPayload = {
    jobs: [
      {
        title: 'Principal Developer',
        location: {
          name: 'Bangalore',
        },
        id: 7938010,
        requisition_id: 'REQ-TW-IND-1',
        absolute_url: 'https://www.thoughtworks.com/careers/jobs/7938010?gh_jid=7938010',
        departments: [
          {
            name: 'Technology',
          },
        ],
        content: '<p>Build modern software with cross-functional teams.</p>',
        updated_at: '2026-06-20T10:00:00Z',
      },
      {
        title: 'Lead Developer',
        location: {
          name: 'London, United Kingdom',
        },
        id: 7938011,
        requisition_id: 'REQ-TW-UK-1',
        absolute_url: 'https://www.thoughtworks.com/careers/jobs/7938011?gh_jid=7938011',
        departments: [
          {
            name: 'Technology',
          },
        ],
        content: '<p>This role should be filtered out by the India location rule.</p>',
        updated_at: '2026-06-20T11:00:00Z',
      },
    ],
  }

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/boards/thoughtworks/jobs?')) return listingsPayload
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-06-20T10:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Principal Developer',
    company: 'Thoughtworks',
    location: 'Bangalore',
    city: 'Bangalore',
    country: 'India',
    link: 'https://www.thoughtworks.com/careers/jobs/7938010?gh_jid=7938010',
    applyUrl: 'https://www.thoughtworks.com/careers/jobs/7938010?gh_jid=7938010',
    sourceUrl: 'https://www.thoughtworks.com/careers/jobs/7938010?gh_jid=7938010',
    source: 'thoughtworks',
    jobId: 7938010,
    requisitionId: 'REQ-TW-IND-1',
    department: 'Technology',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build modern software with cross-functional teams.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
