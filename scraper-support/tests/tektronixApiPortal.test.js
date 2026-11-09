import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps Tektronix Eightfold jobs with detail-owned apply URLs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tektronix')
  assert.ok(provider)

  const requests = []
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url, options = {}) => {
      requests.push({ url, options })

      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 563774609684464,
                displayJobId: 'R-51873',
                name: 'Senior Software Engineer',
                locations: ['Bangalore, Karnataka, India'],
                department: 'Engineering',
                postedTs: 1782464137,
              },
              {
                id: 563774609684465,
                displayJobId: 'R-51874',
                name: 'Principal Systems Engineer',
                locations: ['Beaverton, Oregon, United States'],
                department: 'Engineering',
                postedTs: 1782464138,
              },
            ],
            count: 2,
          },
        }
      }

      if (url.includes('position_id=563774609684464')) {
        return {
          data: {
            publicUrl: 'https://careers.ralliant.com/tektronix/job/563774609684464',
            jobDescription: '<p>Build Tektronix software platforms for India engineering teams.</p>',
            positionUserActions: {
              applyAction: {
                applyUrl: 'https://ralliant.eightfold.ai/candidate?domain=ralliant.com&pid=563774609684464&application=true',
              },
            },
          },
        }
      }

      if (url.includes('position_id=563774609684465')) {
        return {
          data: {
            publicUrl: 'https://careers.ralliant.com/tektronix/job/563774609684465',
            jobDescription: '<p>Design systems for U.S. teams.</p>',
            positionUserActions: {
              applyAction: {
                applyUrl: 'https://ralliant.eightfold.ai/candidate?domain=ralliant.com&pid=563774609684465&application=true',
              },
            },
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.match(requests[0].url, /filter_efcustom_text_operatingcompany=tektronix/i)
  assert.doesNotMatch(requests[0].url, /filter_operating_company=/i)
  assert.doesNotMatch(requests[0].url, /(?:\?|&)location=/i)
  assert.equal(requests[0].options.headers.Accept, 'application/json, text/plain, */*')
  assert.match(requests[0].options.headers['User-Agent'], /Mozilla\/5\.0/)
  assert.equal(requests[0].options.headers.Referer, 'https://careers.ralliant.com/tektronix/')
  assert.equal(requests[0].options.headers.Origin, 'https://careers.ralliant.com')
  assert.deepEqual(requests[1].options.headers, requests[0].options.headers)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Tektronix',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    locations: ['Bangalore, Karnataka, India'],
    sourceNativeLocations: ['Bangalore, Karnataka, India'],
    sourceStandardizedLocations: null,
    link: 'https://careers.ralliant.com/tektronix/job/563774609684464',
    applyUrl: 'https://ralliant.eightfold.ai/candidate?domain=ralliant.com&pid=563774609684464&application=true',
    sourceUrl: 'https://careers.ralliant.com/tektronix/job/563774609684464',
    source: 'tektronix',
    jobId: 563774609684464,
    requisitionId: 'R-51873',
    department: 'Engineering',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782464137,
    jobDescription: '<p>Build Tektronix software platforms for India engineering teams.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
