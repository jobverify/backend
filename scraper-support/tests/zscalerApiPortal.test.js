import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper keeps Zscaler India locations that do not literally contain the word India', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zscaler')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5097585007,
          title: 'Focal Operations Manager',
          location: { name: 'Bangalore, IND; Mohali, IND' },
          absolute_url: 'https://job-boards.greenhouse.io/zscaler/jobs/5097585007',
          departments: [{ name: 'Operations' }],
          content: '<p>Lead focal operations across India delivery sites.</p>',
          updated_at: '2026-07-09T09:30:00Z',
        },
        {
          id: 5097585008,
          title: 'Regional Sales Manager',
          location: { name: 'London, United Kingdom' },
          absolute_url: 'https://job-boards.greenhouse.io/zscaler/jobs/5097585008',
          departments: [{ name: 'Sales' }],
          content: '<p>Own UK market coverage.</p>',
          updated_at: '2026-07-08T09:30:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-09T09:30:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Focal Operations Manager',
    company: 'Zscaler',
    location: 'Bangalore, IND; Mohali, IND',
    city: 'Bangalore',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/zscaler/jobs/5097585007',
    applyUrl: 'https://job-boards.greenhouse.io/zscaler/jobs/5097585007',
    sourceUrl: 'https://job-boards.greenhouse.io/zscaler/jobs/5097585007',
    source: 'zscaler',
    jobId: 5097585007,
    requisitionId: null,
    department: 'Operations',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Lead focal operations across India delivery sites.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
