import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Amdocs Eightfold jobs with detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amdocs')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 563430993790042,
                displayJobId: '563430993790042',
                name: 'DevOps Engineer',
                locations: ['Pune, Maharashtra, India'],
                department: 'Engineering',
                postedTs: 1782600000,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=563430993790042')) {
        return {
          data: {
            publicUrl: 'https://jobs.amdocs.com/careers/job/563430993790042',
            jobDescription: '<p>Build and operate cloud delivery systems.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'DevOps Engineer',
    company: 'Amdocs',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    link: 'https://jobs.amdocs.com/careers/job/563430993790042',
    applyUrl: 'https://jobs.amdocs.com/careers/job/563430993790042',
    sourceUrl: 'https://jobs.amdocs.com/careers/job/563430993790042',
    source: 'amdocs',
    jobId: 563430993790042,
    requisitionId: '563430993790042',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782600000,
    jobDescription: '<p>Build and operate cloud delivery systems.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
