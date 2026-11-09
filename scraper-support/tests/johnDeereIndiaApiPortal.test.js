import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps John Deere India Eightfold jobs from detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'johndeereindia')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 137480465624,
                displayJobId: '107123',
                name: 'Senior Engineer',
                locations: ['Pune, Maharashtra, India'],
                department: 'Engineering',
                postedTs: 1783555200,
              },
              {
                id: 137480465625,
                displayJobId: '107124',
                name: 'US Manufacturing Planner',
                locations: ['Moline, Illinois, United States'],
                department: 'Manufacturing',
                postedTs: 1783555201,
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=137480465624')) {
        return {
          data: {
            publicUrl: 'https://careers.deere.com/careers/job/137480465624',
            jobDescription: '<p>Design and improve Deere engineering systems in Pune.</p>',
          },
        }
      }

      if (url.includes('position_id=137480465625')) {
        return {
          data: {
            publicUrl: 'https://careers.deere.com/careers/job/137480465625',
            jobDescription: '<p>Plan manufacturing operations in the United States.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Engineer',
    company: 'John Deere India',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    locations: ['Pune, Maharashtra, India'],
    sourceNativeLocations: ['Pune, Maharashtra, India'],
    sourceStandardizedLocations: null,
    link: 'https://careers.deere.com/careers/job/137480465624',
    applyUrl: 'https://careers.deere.com/careers/job/137480465624',
    sourceUrl: 'https://careers.deere.com/careers/job/137480465624',
    source: 'johndeereindia',
    jobId: 137480465624,
    requisitionId: '107123',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1783555200,
    jobDescription: '<p>Design and improve Deere engineering systems in Pune.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
