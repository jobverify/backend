import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('Eightfold blank detail error sentinel preserves the native employer description', async () => {
 const provider = getScraperCatalog().find(item => item.source === 'eightfoldai')
 const jobs = await runApiPortalScraper({ provider, fetchJson: withEightfoldFixtureIdentity(provider, async url => ({
  status: 200, error: { message: '', body: '' },
  data: url.includes('/search') ? { positions: [{ id: 8342001, name: 'Senior Software Engineer',
   locations: ['Bengaluru, Karnataka, India'] }], count: 1 }
   : { publicUrl: 'https://app.eightfold.ai/careers/job/8342001', jobDescription: '<p>Build AI-powered talent products.</p>' },
 })) })
 assert.equal(jobs.length, 1)
 assert.equal(jobs[0].jobDescription, '<p>Build AI-powered talent products.</p>')
})

test('runApiPortalScraper maps Eightfold AI jobs from the public Eightfold career hub', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'eightfoldai')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 8342001,
                displayJobId: 'EF-101',
                name: 'Senior Software Engineer',
                locations: ['Bengaluru, Karnataka, India'],
                department: 'Engineering',
                postedTs: 1783000000,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=8342001')) {
        return {
          data: {
            publicUrl: 'https://app.eightfold.ai/careers/job/8342001',
            jobDescription: '<p>Build AI-powered talent products.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Eightfold AI',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    locations: ['Bengaluru, Karnataka, India'],
    sourceNativeLocations: ['Bengaluru, Karnataka, India'],
    sourceStandardizedLocations: null,
    link: 'https://app.eightfold.ai/careers/job/8342001',
    applyUrl: 'https://app.eightfold.ai/careers/job/8342001',
    sourceUrl: 'https://app.eightfold.ai/careers/job/8342001',
    source: 'eightfoldai',
    jobId: 8342001,
    requisitionId: 'EF-101',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1783000000,
    jobDescription: '<p>Build AI-powered talent products.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
