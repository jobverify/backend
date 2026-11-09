import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Arcadia first-party Rippling jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arcadia')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ({
      items: [
        {
          id: '03382773-43a8-4859-a3c8-2e35fc329e17',
          name: 'Lead Engineer',
          url: 'https://ats.rippling.com/arcadiacareers/jobs/03382773-43a8-4859-a3c8-2e35fc329e17',
          department: { name: 'Engineering' },
          locations: [{ name: 'Chennai, India' }],
        },
        {
          id: '28de074d-a1ac-403b-a823-936bd26f7558',
          name: 'Application Security Engineer',
          url: 'https://ats.rippling.com/arcadiacareers/jobs/28de074d-a1ac-403b-a823-936bd26f7558',
          department: { name: 'Engineering' },
          locations: [{ name: 'Remote (United States)' }],
        },
      ],
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead Engineer',
    company: 'Arcadia',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    link: 'https://ats.rippling.com/arcadiacareers/jobs/03382773-43a8-4859-a3c8-2e35fc329e17',
    applyUrl: 'https://ats.rippling.com/arcadiacareers/jobs/03382773-43a8-4859-a3c8-2e35fc329e17',
    sourceUrl: 'https://ats.rippling.com/arcadiacareers/jobs/03382773-43a8-4859-a3c8-2e35fc329e17',
    source: 'arcadia',
    sourceListingComplete: false,
    jobId: '03382773-43a8-4859-a3c8-2e35fc329e17',
    requisitionId: '03382773-43a8-4859-a3c8-2e35fc329e17',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
