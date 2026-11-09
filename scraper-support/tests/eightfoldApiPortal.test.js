import { withEightfoldFixtureIdentity } from './fixtures/eightfoldIdentityMappingFixture.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

test('runApiPortalScraper maps PayPal Eightfold jobs and keeps India roles', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'paypal')
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
                id: 274919842768,
                displayJobId: 'R0136746',
                name: 'Sr Manager, Product Management',
                locations: ['Chennai, Tamil Nadu, India'],
                department: 'Product Management',
                postedTs: 1779667200,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=274919842768')) {
        return {
          data: {
            publicUrl: 'https://paypal.eightfold.ai/careers/job/274919842768',
            jobDescription: '<p>Lead product strategy for India hiring.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(requests[0].options.headers.Accept, 'application/json, text/plain, */*')
  assert.match(requests[0].options.headers['User-Agent'], /Mozilla\/5\.0/)
  assert.equal(
    requests[0].options.headers.Referer,
    'https://paypal.eightfold.ai/careers?domain=paypal.com',
  )
  assert.equal(requests[0].options.headers.Origin, 'https://paypal.eightfold.ai')
  assert.deepEqual(requests[1].options.headers, requests[0].options.headers)
  assert.deepEqual(jobs[0], {
    title: 'Sr Manager, Product Management',
    company: 'PayPal',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    country: 'India',
    link: 'https://paypal.eightfold.ai/careers/job/274919842768',
    applyUrl: 'https://paypal.eightfold.ai/careers/job/274919842768',
    sourceUrl: 'https://paypal.eightfold.ai/careers/job/274919842768',
    source: 'paypal',
    jobId: 274919842768,
    requisitionId: 'R0136746',
    department: 'Product Management',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1779667200,
    jobDescription: '<p>Lead product strategy for India hiring.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})

test('runApiPortalScraper maps Ericsson Eightfold jobs with detail-owned public URLs', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ericsson')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 563121775358443,
                displayJobId: '783055',
                name: 'Specialist Packet Core',
                locations: ['Pune,Maharashtra,India', 'Noida,Uttar Pradesh,India'],
                department: '82 Service Delivery',
                postedTs: 1782464137,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=563121775358443')) {
        return {
          data: {
            publicUrl: 'https://jobs.ericsson.com/careers/job/563121775358443',
            jobDescription: '<p>Build packet core networks for telecom customers.</p>',
          },
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Specialist Packet Core',
    company: 'Ericsson',
    location: 'Pune,Maharashtra,India',
    city: 'Pune',
    country: 'India',
    locations: ['Pune,Maharashtra,India', 'Noida,Uttar Pradesh,India'],
    sourceNativeLocations: ['Pune,Maharashtra,India', 'Noida,Uttar Pradesh,India'],
    sourceStandardizedLocations: null,
    link: 'https://jobs.ericsson.com/careers/job/563121775358443',
    applyUrl: 'https://jobs.ericsson.com/careers/job/563121775358443',
    sourceUrl: 'https://jobs.ericsson.com/careers/job/563121775358443',
    source: 'ericsson',
    jobId: 563121775358443,
    requisitionId: '783055',
    department: '82 Service Delivery',
    employmentType: null,
    experienceRequired: null,
    postingDate: 1782464137,
    jobDescription: '<p>Build packet core networks for telecom customers.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})

test('runApiPortalScraper keeps Eightfold listing jobs when optional details are blocked', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'paypal')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: withEightfoldFixtureIdentity(provider, async (url) => {
      if (url.includes('/api/pcsx/search')) {
        return {
          data: {
            positions: [
              {
                id: 274919842768,
                displayJobId: 'R0136746',
                name: 'Software Engineer',
                locations: ['Bengaluru, Karnataka, India'],
                department: 'Engineering',
                postedTs: 1779667200,
              },
            ],
            count: 1,
          },
        }
      }

      if (url.includes('position_id=274919842768')) {
        throw new Error('HTTP 403 for detail endpoint')
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    }),
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceUrl, 'https://paypal.eightfold.ai/careers/job/274919842768')
  assert.equal(jobs[0].applyUrl, 'https://paypal.eightfold.ai/careers/job/274919842768')
  assert.equal(jobs[0].jobDescription, null)
})
