import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps STMicroelectronics Eightfold jobs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'stmicroelectronics')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1100000000001,
                displayJobId: 'R-10001',
                name: 'Firmware Engineer',
                locations: ['Greater Noida, Uttar Pradesh, India'],
                department: 'Engineering',
                postedTs: 1783000000,
              },
              {
                id: 1100000000002,
                displayJobId: 'R-10002',
                name: 'Analog Design Engineer',
                locations: ['Catania, Sicily, Italy'],
                department: 'Design',
                postedTs: 1783000001,
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=1100000000001')) {
        return {
          data: {
            publicUrl: 'https://stmicroelectronics.eightfold.ai/careers/job/1100000000001',
            jobDescription: '<p>Build firmware for India product teams.</p>',
          },
        }
      }

      if (url.includes('position_id=1100000000002')) {
        return {
          data: {
            publicUrl: 'https://stmicroelectronics.eightfold.ai/careers/job/1100000000002',
            jobDescription: '<p>Design analog circuits in Italy.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Firmware Engineer',
    company: 'STMicroelectronics',
    location: 'Greater Noida, Uttar Pradesh, India',
    city: 'Greater Noida',
    country: 'India',
    locations: ['Greater Noida, Uttar Pradesh, India'],
    sourceNativeLocations: ['Greater Noida, Uttar Pradesh, India'],
    sourceStandardizedLocations: null,
    link: 'https://stmicroelectronics.eightfold.ai/careers/job/1100000000001',
    applyUrl: 'https://stmicroelectronics.eightfold.ai/careers/job/1100000000001',
    sourceUrl: 'https://stmicroelectronics.eightfold.ai/careers/job/1100000000001',
    source: 'stmicroelectronics',
    jobId: 1100000000001,
    requisitionId: 'R-10001',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1783000000,
    jobDescription: '<p>Build firmware for India product teams.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
