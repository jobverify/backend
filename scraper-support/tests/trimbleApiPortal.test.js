import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Trimble Eightfold jobs with detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'trimble')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 171840270471,
                displayJobId: 'R55609',
                name: 'Lead Software Engineer',
                locations: ['India - Chennai'],
                standardizedLocations: ['Chennai, TN, IN'],
                department: 'Software Engineering',
                postedTs: 1780531200,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=171840270471')) {
        return {
          data: {
            publicUrl: 'https://trimble.eightfold.ai/careers/job/171840270471',
            jobDescription: '<p>Build Trimble platform services for India teams.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead Software Engineer',
    company: 'Trimble Inc',
    location: 'India - Chennai',
    city: 'India',
    country: 'India',
    locations: ['India - Chennai'],
    sourceNativeLocations: ['India - Chennai'],
    sourceStandardizedLocations: ['Chennai, TN, IN'],
    link: 'https://trimble.eightfold.ai/careers/job/171840270471',
    applyUrl: 'https://trimble.eightfold.ai/careers/job/171840270471',
    sourceUrl: 'https://trimble.eightfold.ai/careers/job/171840270471',
    source: 'trimble',
    jobId: 171840270471,
    requisitionId: 'R55609',
    department: 'Software Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1780531200,
    jobDescription: '<p>Build Trimble platform services for India teams.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
