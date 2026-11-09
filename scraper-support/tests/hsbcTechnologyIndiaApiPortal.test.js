import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps HSBC Technology India Eightfold jobs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hsbctechnologyindia')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 563774609684464,
                displayJobId: 'R-51873-1',
                name: 'Senior Java Lead Engineer',
                locations: ['Pune, Maharashtra, India'],
                department: 'Technology',
                postedTs: 1782464137,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=563774609684464')) {
        return {
          data: {
            publicUrl: 'https://portal.careers.hsbc.com/careers/job/563774609684464-senior-java-lead-engineer-senior-associate-director-technology-management-pune-maharashtra-india?domain=hsbc.com',
            jobDescription: '<p>Lead large-scale Java engineering for HSBC Technology India.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Java Lead Engineer',
    company: 'HSBC Technology India',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    locations: ['Pune, Maharashtra, India'],
    sourceNativeLocations: ['Pune, Maharashtra, India'],
    sourceStandardizedLocations: null,
    link: 'https://portal.careers.hsbc.com/careers/job/563774609684464-senior-java-lead-engineer-senior-associate-director-technology-management-pune-maharashtra-india?domain=hsbc.com',
    applyUrl: 'https://portal.careers.hsbc.com/careers/job/563774609684464-senior-java-lead-engineer-senior-associate-director-technology-management-pune-maharashtra-india?domain=hsbc.com',
    sourceUrl: 'https://portal.careers.hsbc.com/careers/job/563774609684464-senior-java-lead-engineer-senior-associate-director-technology-management-pune-maharashtra-india?domain=hsbc.com',
    source: 'hsbctechnologyindia',
    jobId: 563774609684464,
    requisitionId: 'R-51873-1',
    department: 'Technology',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782464137,
    jobDescription: '<p>Lead large-scale Java engineering for HSBC Technology India.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
