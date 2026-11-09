import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper keeps only Commvault Greenhouse jobs in India', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'commvault')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5166471008,
          title: 'Enterprise Account Executive-BFSI',
          location: { name: 'Mumbai, India' },
          absolute_url: 'https://job-boards.greenhouse.io/commvault/jobs/5166471008',
          departments: [{ name: 'Sales & Sales Engineering' }],
          content: '<p>Build enterprise customer relationships.</p>',
          updated_at: '2026-07-07T09:00:00Z',
        },
        {
          id: 5166471009,
          title: 'Cloud Resilience Account Executive',
          location: { name: 'Austin, Texas, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/commvault/jobs/5166471009',
          departments: [{ name: 'Sales & Sales Engineering' }],
          content: '<p>Grow the regional business.</p>',
          updated_at: '2026-07-07T09:00:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-07T09:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Enterprise Account Executive-BFSI',
    company: 'Commvault',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/commvault/jobs/5166471008',
    applyUrl: 'https://job-boards.greenhouse.io/commvault/jobs/5166471008',
    sourceUrl: 'https://job-boards.greenhouse.io/commvault/jobs/5166471008',
    source: 'commvault',
    jobId: 5166471008,
    requisitionId: null,
    department: 'Sales & Sales Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build enterprise customer relationships.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
