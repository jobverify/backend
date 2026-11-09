import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Lam Research Eightfold jobs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lamresearch')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 1099553880939,
                displayJobId: 'R-90001',
                name: 'Process Engineer',
                locations: ['Bengaluru, Karnataka, India'],
                department: 'Engineering',
                postedTs: 1782464137,
              },
              {
                id: 1099553880940,
                displayJobId: 'R-90002',
                name: 'US Supply Chain Planner',
                locations: ['Fremont, California, United States'],
                department: 'Supply Chain',
                postedTs: 1782464137,
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=1099553880939')) {
        return {
          data: {
            publicUrl: 'https://lamresearch.eightfold.ai/careers/job/1099553880939',
            jobDescription: '<p>Support semiconductor process engineering in India.</p>',
          },
        }
      }

      if (url.includes('position_id=1099553880940')) {
        return {
          data: {
            publicUrl: 'https://lamresearch.eightfold.ai/careers/job/1099553880940',
            jobDescription: '<p>Plan supply-chain operations in the United States.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Process Engineer',
    company: 'Lam Research',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    locations: ['Bengaluru, Karnataka, India'],
    sourceNativeLocations: ['Bengaluru, Karnataka, India'],
    sourceStandardizedLocations: null,
    link: 'https://lamresearch.eightfold.ai/careers/job/1099553880939',
    applyUrl: 'https://lamresearch.eightfold.ai/careers/job/1099553880939',
    sourceUrl: 'https://lamresearch.eightfold.ai/careers/job/1099553880939',
    source: 'lamresearch',
    jobId: 1099553880939,
    requisitionId: 'R-90001',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782464137,
    jobDescription: '<p>Support semiconductor process engineering in India.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
