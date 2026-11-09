import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Observe.AI Greenhouse jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'observeai')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      jobs: [
        {
          id: 5254531008,
          title: 'AI Agent Engineer, Client Facing',
          location: { name: 'Bengaluru, India' },
          absolute_url: 'https://www.observe.ai/position?gh_jid=5254531008',
          departments: [{ name: 'Engineering' }],
          content: '<p>Help customers ship AI agents.</p>',
          updated_at: '2026-07-08T09:30:00Z',
        },
        {
          id: 5220338008,
          title: 'GRC Leader',
          location: { name: 'San Francisco, California, United States' },
          absolute_url: 'https://www.observe.ai/position?gh_jid=5220338008',
          departments: [{ name: 'Security' }],
          content: '<p>Lead governance and compliance.</p>',
          updated_at: '2026-07-07T09:30:00Z',
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  const { nativePublication, ...mappedJob } = jobs[0]
  assert.equal(nativePublication.status, 'unknown')
  assert.equal(nativePublication.value, null)
  assert.equal(nativePublication.candidates[0].updated_at, '2026-07-08T09:30:00Z')
  assert.equal(nativePublication.candidates[1].status, 'not-observed')
  assert.deepEqual(mappedJob, {
    title: 'AI Agent Engineer, Client Facing',
    company: 'Observe.AI',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://www.observe.ai/position?gh_jid=5254531008',
    applyUrl: 'https://www.observe.ai/position?gh_jid=5254531008',
    sourceUrl: 'https://www.observe.ai/position?gh_jid=5254531008',
    source: 'observeai',
    jobId: 5254531008,
    requisitionId: null,
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: '<p>Help customers ship AI agents.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
})
