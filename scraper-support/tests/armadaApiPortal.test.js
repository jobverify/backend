import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Armada Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'armada')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 4619602008,
          title: 'Software Engineer',
          requisition_id: 'ARM-108',
          location: { name: 'Bengaluru, Karnataka, India' },
          absolute_url: 'https://job-boards.greenhouse.io/armada/jobs/4619602008',
          departments: [{ name: 'Engineering' }],
          content: '<p>Build resilient software for distributed edge systems.</p>',
          updated_at: '2026-07-08T09:00:00Z',
        },
        {
          id: 4619602009,
          title: 'Product Designer',
          requisition_id: 'ARM-109',
          location: { name: 'San Francisco, California, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/armada/jobs/4619602009',
          departments: [{ name: 'Design' }],
          content: '<p>Shape product experiences for global teams.</p>',
          updated_at: '2026-07-08T09:00:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-08T09:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Software Engineer',
    company: 'Armada',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/armada/jobs/4619602008',
    applyUrl: 'https://job-boards.greenhouse.io/armada/jobs/4619602008',
    sourceUrl: 'https://job-boards.greenhouse.io/armada/jobs/4619602008',
    source: 'armada',
    jobId: 4619602008,
    requisitionId: 'ARM-108',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build resilient software for distributed edge systems.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
