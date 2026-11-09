import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Booking.com preserves the India job while two native rows contradict a total of one', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bookingcom')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url === 'https://jobs.booking.com/api/jobs?country=India&page=1') {
        return {
          jobs: [
            {
              data: {
                slug: '29502',
                req_id: '29502',
                title: 'FullStack Engineer II - EVERGREEN',
                full_location: 'Bangalore, Karnataka, India',
                city: 'Bangalore',
                state: 'Karnataka',
                country: 'India',
                apply_url: 'https://careers-holdings-workingatbooking.icims.com/jobs/29502/login',
                description: '<p>Build travel experiences.</p>',
                employment_type: 'FULL_TIME',
                categories: [{ name: 'Engineering' }],
                posted_date: '2026-07-13T16:29:00+0000',
              },
            },
            {
              data: {
                slug: '99999',
                req_id: '99999',
                title: 'US Role',
                full_location: 'Seattle, Washington, United States',
                city: 'Seattle',
                state: 'Washington',
                country: 'United States',
                apply_url: 'https://careers-holdings-workingatbooking.icims.com/jobs/99999/login',
                description: '<p>Ignore non-India role.</p>',
                employment_type: 'FULL_TIME',
                categories: [{ name: 'Engineering' }],
                posted_date: '2026-07-13T16:29:00+0000',
              },
            },
          ],
          totalCount: 1,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'FullStack Engineer II - EVERGREEN',
    company: 'Booking.com',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://jobs.booking.com/booking/jobs/29502?lang=en-us',
    applyUrl: 'https://careers-holdings-workingatbooking.icims.com/jobs/29502/login',
    sourceUrl: 'https://jobs.booking.com/booking/jobs/29502?lang=en-us',
    source: 'bookingcom',
    jobId: '29502',
    requisitionId: '29502',
    department: 'Engineering',
    employmentType: 'FULL_TIME',
    experienceRequired: null,
    postingDate: '2026-07-13T16:29:00+0000',
    jobDescription: '<p>Build travel experiences.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.reason, 'api-portal-incomplete-listing-or-role-details:upstream-count-mismatch')
})
