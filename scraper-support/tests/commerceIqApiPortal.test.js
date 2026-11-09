import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper keeps only CommerceIQ Greenhouse jobs in India and excludes talent community rows', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'commerceiq')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 9123456008,
          title: 'Senior Software Engineer',
          location: { name: 'Bengaluru, Karnataka, India' },
          absolute_url: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456008',
          departments: [{ name: 'Engineering' }],
          content: '<p>Build retail intelligence systems.</p>',
          updated_at: '2026-07-14T09:00:00Z',
        },
        {
          id: 9123456009,
          title: 'CIQ Talent Community',
          location: { name: 'Bengaluru, Karnataka, India' },
          absolute_url: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456009',
          departments: [{ name: 'Talent' }],
          content: '<p>Join our talent community.</p>',
          updated_at: '2026-07-14T09:10:00Z',
        },
        {
          id: 9123456010,
          title: 'US Account Executive',
          location: { name: 'Austin, Texas, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456010',
          departments: [{ name: 'Sales' }],
          content: '<p>Grow the US territory.</p>',
          updated_at: '2026-07-14T09:20:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-14T09:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Senior Software Engineer',
    company: 'CommerceIQ',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456008',
    applyUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456008',
    sourceUrl: 'https://job-boards.greenhouse.io/commerceiq/jobs/9123456008',
    source: 'commerceiq',
    jobId: 9123456008,
    requisitionId: null,
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build retail intelligence systems.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
