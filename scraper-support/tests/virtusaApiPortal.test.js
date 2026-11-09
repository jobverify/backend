import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const listingsPayload = {
  data: {
    jobListResults: {
      results: [
        {
          contestNumber: 'VRT-123',
          title: 'Cloud Engineer',
          city: 'Hyderabad',
          country: 'India',
          careerCtaLink: '/careers/job-search/in/cloud-engineer-vrt-123',
          jobField: 'Engineering',
          jobSchedule: 'Full-time',
          postedDate: '2026-07-01',
          yearsOfExperience: '5',
          descriptionExternalHTML: '<p>Design and operate cloud data platforms for enterprise workloads.</p>',
          externalQualificationHTML: '<ul><li>Bachelor degree</li></ul>',
        },
        {
          contestNumber: 'VRT-456',
          title: 'Platform Engineer',
          city: 'New York',
          country: 'United States',
          careerCtaLink: '/careers/job-search/us/platform-engineer-vrt-456',
          jobField: 'Engineering',
          jobSchedule: 'Full-time',
          postedDate: '2026-07-01',
        },
      ],
    },
  },
}

test('Virtusa retains the India job while the missing foreign-role description keeps the full feed partial', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'virtusa')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url, options = {}) => {
      assert.equal(url, 'https://prod.agenticweb-marketing.com/careers/graphql')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.match(JSON.parse(options.body).query, /jobListResults\(isList: "true"\)/)
      assert.match(JSON.parse(options.body).query, /yearsOfExperience/)
      assert.match(JSON.parse(options.body).query, /descriptionExternalHTML/)
      assert.match(JSON.parse(options.body).query, /externalQualificationHTML/)
      return listingsPayload
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Cloud Engineer',
    company: 'Virtusa',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    link: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    applyUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    sourceUrl: 'https://www.virtusa.com/careers/job-search/in/cloud-engineer-vrt-123',
    source: 'virtusa',
    jobId: 'VRT-123',
    requisitionId: 'VRT-123',
    department: 'Engineering',
    employmentType: 'Full-time',
    experienceRequired: '5 years',
    postingDate: '2026-07-01',
    jobDescription: '<p>Design and operate cloud data platforms for enterprise workloads.</p>',
    minimumQualification: '<ul><li>Bachelor degree</li></ul>',
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.reason, 'api-portal-incomplete-listing-or-role-details:employer-description-unavailable')
})
