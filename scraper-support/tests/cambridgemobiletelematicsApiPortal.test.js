import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Cambridge Mobile Telematics Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find(
    (item) => item.source === 'cambridgemobiletelematics',
  )
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 7818122,
          title: 'Software Engineer II, Mobile',
          location: { name: 'Chennai, India' },
          absolute_url:
            'https://job-boards.greenhouse.io/cambridgemobiletelematics/jobs/7818122',
          departments: [{ name: 'Engineering' }],
          content: '<p>Ship safety and telematics products for drivers.</p>',
          updated_at: '2026-07-01T09:00:00Z',
        },
        {
          id: 7818123,
          title: 'Product Manager',
          location: { name: 'Cambridge, Massachusetts, United States' },
          absolute_url:
            'https://job-boards.greenhouse.io/cambridgemobiletelematics/jobs/7818123',
          departments: [{ name: 'Product' }],
          content: '<p>Lead roadmap planning for insurance analytics.</p>',
          updated_at: '2026-07-02T09:00:00Z',
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
    title: 'Software Engineer II, Mobile',
    company: 'Cambridge Mobile Telematics',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    link: 'https://job-boards.greenhouse.io/cambridgemobiletelematics/jobs/7818122',
    applyUrl:
      'https://job-boards.greenhouse.io/cambridgemobiletelematics/jobs/7818122',
    sourceUrl:
      'https://job-boards.greenhouse.io/cambridgemobiletelematics/jobs/7818122',
    source: 'cambridgemobiletelematics',
    jobId: 7818122,
    requisitionId: null,
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Ship safety and telematics products for drivers.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
