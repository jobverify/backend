import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Worley Eightfold jobs from the official public careers API', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'worley')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1133914235239,
                displayJobId: 'HYD01AE',
                name: 'Civil Designer Level II',
                standardizedLocations: ['Hyderabad, Telangana, India'],
                locations: ['Andra Pradesh, India'],
                department: 'Engineering',
                postedTs: 1783574400,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=1133914235239')) {
        return {
          data: {
            publicUrl: 'https://jobs.worley.com/careers/job/1133914235239',
            jobDescription: '<p>Design offshore and onshore civil systems.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Civil Designer Level II',
    company: 'Worley',
    location: 'Andra Pradesh, India',
    city: 'Andra Pradesh',
    country: 'India',
    locations: ['Andra Pradesh, India'],
    sourceNativeLocations: ['Andra Pradesh, India'],
    sourceStandardizedLocations: ['Hyderabad, Telangana, India'],
    link: 'https://jobs.worley.com/careers/job/1133914235239',
    applyUrl: 'https://jobs.worley.com/careers/job/1133914235239',
    sourceUrl: 'https://jobs.worley.com/careers/job/1133914235239',
    source: 'worley',
    jobId: 1133914235239,
    requisitionId: 'HYD01AE',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1783574400,
    jobDescription: '<p>Design offshore and onshore civil systems.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
