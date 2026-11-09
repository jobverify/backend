import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps AstraZeneca Eightfold jobs with detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'astrazeneca')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 563877690129578,
                displayJobId: 'R-251629',
                name: 'Head Distribution and Retail',
                locations: ['Mumbai, Maharashtra, India'],
                department: 'Sales',
                postedTs: 1779062400,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=563877690129578')) {
        return {
          data: {
            publicUrl: 'https://astrazeneca.eightfold.ai/careers/job/563877690129578',
            jobDescription: '<p>Lead distributor network strategy and channel partner management.</p>',
            workLocationOption: 'onsite',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Head Distribution and Retail',
    company: 'AstraZeneca',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    link: 'https://astrazeneca.eightfold.ai/careers/job/563877690129578',
    applyUrl: 'https://astrazeneca.eightfold.ai/careers/job/563877690129578',
    sourceUrl: 'https://astrazeneca.eightfold.ai/careers/job/563877690129578',
    source: 'astrazeneca',
    jobId: 563877690129578,
    requisitionId: 'R-251629',
    department: 'Sales',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1779062400,
    jobDescription: '<p>Lead distributor network strategy and channel partner management.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
