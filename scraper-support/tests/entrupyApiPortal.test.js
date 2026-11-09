import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Entrupy Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'entrupy')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 4320156007,
          title: 'Senior Full Stack Engineer, Dashboard',
          location: { name: 'Bangalore, India' },
          absolute_url: 'https://job-boards.greenhouse.io/entrupy/jobs/4320156007',
          departments: [{ name: 'Engineering' }],
          content: '<p>Build product experiences for the Dashboard team.</p>',
          updated_at: '2026-07-09T07:00:00Z',
        },
        {
          id: 4320156008,
          title: 'Senior Account Executive',
          location: { name: 'New York, New York, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/entrupy/jobs/4320156008',
          departments: [{ name: 'Sales' }],
          content: '<p>Expand enterprise sales coverage.</p>',
          updated_at: '2026-07-08T07:00:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-09T07:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Senior Full Stack Engineer, Dashboard',
    company: 'Entrupy',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/entrupy/jobs/4320156007',
    applyUrl: 'https://job-boards.greenhouse.io/entrupy/jobs/4320156007',
    sourceUrl: 'https://job-boards.greenhouse.io/entrupy/jobs/4320156007',
    source: 'entrupy',
    jobId: 4320156007,
    requisitionId: null,
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build product experiences for the Dashboard team.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
