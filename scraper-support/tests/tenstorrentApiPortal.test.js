import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper keeps Tenstorrent India Greenhouse jobs and drops non-India listings', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tenstorrent')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5164498007,
          title: '(India) System IP Design Engineer',
          location: { name: 'Bengaluru, Karnataka, India' },
          absolute_url: 'https://job-boards.greenhouse.io/tenstorrent/jobs/5164498007',
          departments: [{ name: 'Engineering - Hardware' }],
          content: '<p>This role is hybrid, based out of Bangalore, India.</p>',
          updated_at: '2026-07-10T00:00:00Z',
        },
        {
          id: 9999999001,
          title: 'Physical Design Engineer',
          location: { name: 'Tokyo, Japan' },
          absolute_url: 'https://job-boards.greenhouse.io/tenstorrent/jobs/9999999001',
          departments: [{ name: 'Engineering - Hardware' }],
          content: '<p>Japan-based role.</p>',
          updated_at: '2026-07-10T00:00:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-10T00:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: '(India) System IP Design Engineer',
    company: 'Tenstorrent',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/tenstorrent/jobs/5164498007',
    applyUrl: 'https://job-boards.greenhouse.io/tenstorrent/jobs/5164498007',
    sourceUrl: 'https://job-boards.greenhouse.io/tenstorrent/jobs/5164498007',
    source: 'tenstorrent',
    jobId: 5164498007,
    requisitionId: null,
    department: 'Engineering - Hardware',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>This role is hybrid, based out of Bangalore, India.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
