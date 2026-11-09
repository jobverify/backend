import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Applied Materials Eightfold jobs with detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'appliedmaterials')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 734975066530136,
                displayJobId: 'R2519146',
                name: 'Software Engineer II',
                locations: ['Bengaluru, Karnataka, India'],
                department: 'Engineering',
                postedTs: 1782864000,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=734975066530136')) {
        return {
          data: {
            publicUrl: 'https://careers.appliedmaterials.com/careers/job/734975066530136',
            jobDescription: '<p>Build factory software platforms for semiconductor systems.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer II',
    company: 'Applied Materials',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://careers.appliedmaterials.com/careers/job/734975066530136',
    applyUrl: 'https://careers.appliedmaterials.com/careers/job/734975066530136',
    sourceUrl: 'https://careers.appliedmaterials.com/careers/job/734975066530136',
    source: 'appliedmaterials',
    jobId: 734975066530136,
    requisitionId: 'R2519146',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782864000,
    jobDescription: '<p>Build factory software platforms for semiconductor systems.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
