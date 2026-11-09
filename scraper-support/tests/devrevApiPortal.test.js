import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters DevRev Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'devrev')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5668939004,
          title: 'Forward Deployed Engineer',
          requisition_id: 'DEVREV-123',
          location: { name: 'Bangalore, India; Chennai, India' },
          absolute_url: 'https://job-boards.greenhouse.io/devrev/jobs/5668939004',
          departments: [{ name: 'Engineering - Applied AI Engineering' }],
          content: '<p>Build AI-native solutions with customers.</p>',
          updated_at: '2026-07-01T09:00:00Z',
        },
        {
          id: 5689724004,
          title: 'Account Executive',
          location: { name: 'Palo Alto, California, United States' },
          absolute_url: 'https://job-boards.greenhouse.io/devrev/jobs/5689724004',
          departments: [{ name: 'Sales' }],
          content: '<p>Grow enterprise accounts.</p>',
          updated_at: '2026-07-01T09:00:00Z',
        },
        {
          id: 5836212004,
          title: 'Channel Partner Manager - Dach Region',
          location: { name: 'Germany Remote' },
          absolute_url: 'https://job-boards.greenhouse.io/devrev/jobs/5836212004',
          departments: [{ name: 'Partnerships' }],
          content: '<p>Build strategic regional partnerships.</p>',
          updated_at: '2026-07-01T09:00:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-01T09:00:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Forward Deployed Engineer',
    company: 'DevRev',
    location: 'Bangalore, India; Chennai, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/devrev/jobs/5668939004',
    applyUrl: 'https://job-boards.greenhouse.io/devrev/jobs/5668939004',
    sourceUrl: 'https://job-boards.greenhouse.io/devrev/jobs/5668939004',
    source: 'devrev',
    jobId: 5668939004,
    requisitionId: 'DEVREV-123',
    department: 'Engineering - Applied AI Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Build AI-native solutions with customers.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
