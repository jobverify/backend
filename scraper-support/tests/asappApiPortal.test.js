import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('runApiPortalScraper filters ASAPP Lever jobs to India-facing locations', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'asapp')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async () => ([
      {
        id: '152c4868-2708-4817-a2eb-25fc4141398c',
        text: 'Demo Engineer',
        applyUrl: 'https://jobs.lever.co/asapp-2/152c4868-2708-4817-a2eb-25fc4141398c/apply',
        hostedUrl: 'https://jobs.lever.co/asapp-2/152c4868-2708-4817-a2eb-25fc4141398c',
        categories: {
          location: 'Bangalore',
          department: 'Solutions Engineering',
          commitment: 'Full-time',
        },
        descriptionBodyPlain: 'Help customers evaluate the ASAPP platform.',
        createdAt: '2026-06-18T10:00:00.000Z',
      },
      {
        id: '8a6e01bf-7f2e-42e0-92ea-13ca0b9f0704',
        text: 'Account Executive',
        applyUrl: 'https://jobs.lever.co/asapp-2/8a6e01bf-7f2e-42e0-92ea-13ca0b9f0704/apply',
        hostedUrl: 'https://jobs.lever.co/asapp-2/8a6e01bf-7f2e-42e0-92ea-13ca0b9f0704',
        categories: {
          location: 'New York',
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
    title: 'Demo Engineer',
    company: 'ASAPP',
    location: 'Bangalore',
    city: 'Bangalore',
    country: null,
    link: 'https://jobs.lever.co/asapp-2/152c4868-2708-4817-a2eb-25fc4141398c',
    applyUrl: 'https://jobs.lever.co/asapp-2/152c4868-2708-4817-a2eb-25fc4141398c/apply',
    sourceUrl: 'https://jobs.lever.co/asapp-2/152c4868-2708-4817-a2eb-25fc4141398c',
    source: 'asapp',
    jobId: '152c4868-2708-4817-a2eb-25fc4141398c',
    requisitionId: '152c4868-2708-4817-a2eb-25fc4141398c',
    department: 'Solutions Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    jobDescription: 'Help customers evaluate the ASAPP platform.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-18T10:00:00.000Z',
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
  // Neither fixture has a native country; preserve that field as unknown. The India city is usable,
  // but that unknown location cannot establish complete global/India scope.
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
