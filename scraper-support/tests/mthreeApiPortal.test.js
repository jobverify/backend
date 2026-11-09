import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters mthree Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mthree')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 4454650006,
          title: 'Graduate Software Engineer',
          location: { name: 'Bengaluru, India' },
          absolute_url: 'https://mthree.com/careers/job/?gh_jid=4454650006',
          requisition_id: '848',
          departments: [{ name: 'Technology' }],
          content: '<p>Launch your technology consulting career.</p>',
          updated_at: '2026-06-29T11:30:50-04:00',
        },
        {
          id: 4454650007,
          title: 'Production Support Analyst',
          location: { name: 'Montreal, QC' },
          absolute_url: 'https://mthree.com/careers/job/?gh_jid=4454650007',
          requisition_id: '849',
          departments: [{ name: 'Operations' }],
          content: '<p>Support global production workflows.</p>',
          updated_at: '2026-06-28T11:30:50-04:00',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-06-29T11:30:50-04:00')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'Graduate Software Engineer',
    company: 'mthree',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://mthree.com/careers/job/?gh_jid=4454650006',
    applyUrl: 'https://mthree.com/careers/job/?gh_jid=4454650006',
    sourceUrl: 'https://mthree.com/careers/job/?gh_jid=4454650006',
    source: 'mthree',
    jobId: 4454650006,
    requisitionId: '848',
    department: 'Technology',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Launch your technology consulting career.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
