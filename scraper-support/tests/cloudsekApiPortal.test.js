import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters CloudSEK Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cloudsek')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5808129004,
          title: 'Backend SDE-III',
          location: { name: 'Bengaluru, Karnataka, India' },
          absolute_url: 'https://job-boards.greenhouse.io/cloudsek/jobs/5808129004',
          departments: [{ name: 'Engineering' }],
          content: '<p>Build backend systems for cyber intelligence products.</p>',
          updated_at: '2026-07-07T09:00:00Z',
        },
        {
          id: 5808129005,
          title: 'US Security Researcher',
          location: { name: 'Austin, Texas, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/cloudsek/jobs/5808129005',
          departments: [{ name: 'Research' }],
          content: '<p>Support North America engagements.</p>',
          updated_at: '2026-07-07T08:00:00Z',
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
    title: 'Backend SDE-III',
    company: 'CloudSEK',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/cloudsek/jobs/5808129004',
    applyUrl: 'https://job-boards.greenhouse.io/cloudsek/jobs/5808129004',
    sourceUrl: 'https://job-boards.greenhouse.io/cloudsek/jobs/5808129004',
    source: 'cloudsek',
    jobId: 5808129004,
    requisitionId: null,
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build backend systems for cyber intelligence products.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
