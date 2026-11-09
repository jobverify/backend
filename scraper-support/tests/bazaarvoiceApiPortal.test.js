import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper filters Bazaarvoice Lever jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bazaarvoice')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ([
      {
        id: 'india-role-1',
        text: 'Software Engineer II',
        applyUrl: 'https://jobs.lever.co/bazaarvoice/india-role-1/apply',
        hostedUrl: 'https://jobs.lever.co/bazaarvoice/india-role-1',
        categories: {
          location: 'Bengaluru, India',
          department: 'Engineering',
          commitment: 'Full-time',
        },
        descriptionBodyPlain: 'Build product experiences for global retail brands.',
        createdAt: '2026-06-18T10:00:00.000Z',
      },
      {
        id: 'us-role-1',
        text: 'Account Executive',
        applyUrl: 'https://jobs.lever.co/bazaarvoice/us-role-1/apply',
        hostedUrl: 'https://jobs.lever.co/bazaarvoice/us-role-1',
        categories: {
          location: 'Austin, United States',
          department: 'Sales',
          commitment: 'Full-time',
        },
        descriptionBodyPlain: 'Drive enterprise growth in North America.',
        createdAt: '2026-06-10T10:00:00.000Z',
      },
    ]),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer II',
    company: 'Bazaarvoice',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://jobs.lever.co/bazaarvoice/india-role-1',
    applyUrl: 'https://jobs.lever.co/bazaarvoice/india-role-1/apply',
    sourceUrl: 'https://jobs.lever.co/bazaarvoice/india-role-1',
    source: 'bazaarvoice',
    jobId: 'india-role-1',
    requisitionId: 'india-role-1',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Build product experiences for global retail brands.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-18T10:00:00.000Z',
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
