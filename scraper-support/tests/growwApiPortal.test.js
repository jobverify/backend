import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Groww Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'groww')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 4880153101,
          title: 'Associate - Content (Digest)',
          requisition_id: 'GRID-17155',
          location: { name: 'Bengaluru-VTP, India' },
          absolute_url: 'https://job-boards.eu.greenhouse.io/groww/jobs/4880153101',
          departments: [{ name: 'Growth' }],
          content: '<p>Own content workflows for Groww digest surfaces.</p>',
          updated_at: '2026-06-03T02:46:08-04:00',
        },
        {
          id: 4880999901,
          title: 'Risk Analyst',
          requisition_id: 'GRID-17177',
          location: { name: 'London, United Kingdom' },
          absolute_url: 'https://job-boards.eu.greenhouse.io/groww/jobs/4880999901',
          departments: [{ name: 'Risk' }],
          content: '<p>Support international risk programs.</p>',
          updated_at: '2026-06-09T10:00:00-04:00',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-06-03T02:46:08-04:00')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Associate - Content (Digest)',
    company: 'Groww',
    location: 'Bengaluru-VTP, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://job-boards.eu.greenhouse.io/groww/jobs/4880153101',
    applyUrl: 'https://job-boards.eu.greenhouse.io/groww/jobs/4880153101',
    sourceUrl: 'https://job-boards.eu.greenhouse.io/groww/jobs/4880153101',
    source: 'groww',
    jobId: 4880153101,
    requisitionId: 'GRID-17155',
    department: 'Growth',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Own content workflows for Groww digest surfaces.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
