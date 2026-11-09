import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

import { runApiPortalScraper } from '../apiPortal/engine.js'

test('the archived SLB Eightfold profile retains generic field mapping after current SLB careers moved to its company index', async () => {
  const provider = JSON.parse(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/slb-legacy-eightfold-profile.json',import.meta.url)))
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 5001,
                displayJobId: 'R-5001',
                name: 'Senior Data Engineer',
                locations: ['Pune, Maharashtra, India'],
                department: 'Digital',
                postedTs: 1783600000,
              },
              {
                id: 5002,
                displayJobId: 'R-5002',
                name: 'Reservoir Simulation Engineer',
                locations: ['Houston, Texas, United States'],
                department: 'Reservoir',
                postedTs: 1783601000,
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=5001')) {
        return {
          data: {
            publicUrl: 'https://apply.slb.com/careers/job/5001-senior-data-engineer?domain=slb.com',
            jobDescription: '<p>Build drilling and reservoir data platforms.</p>',
          },
        }
      }

      if (url.includes('position_id=5002')) {
        return {
          data: {
            publicUrl: 'https://apply.slb.com/careers/job/5002-reservoir-simulation-engineer?domain=slb.com',
            jobDescription: '<p>Support reservoir modeling teams in Houston.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Engineer',
    company: 'SLB',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    locations: ['Pune, Maharashtra, India'],
    sourceNativeLocations: ['Pune, Maharashtra, India'],
    sourceStandardizedLocations: null,
    link: 'https://apply.slb.com/careers/job/5001',
    applyUrl: 'https://apply.slb.com/careers/apply?pid=5001&domain=slb.com',
    sourceUrl: 'https://apply.slb.com/careers/job/5001',
    source: 'slb',
    jobId: 5001,
    requisitionId: 'R-5001',
    department: 'Digital',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1783600000,
    jobDescription: '<p>Build drilling and reservoir data platforms.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
