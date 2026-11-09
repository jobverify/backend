import assert from 'node:assert/strict'
import test from 'node:test'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const listingsPayload = {
  requesterTitle: '',
  reqDetailsBOList: [
    {
      reqId: 371,
      statusId: 3,
      buName: 'Management - Revenue Operations and Strategy-(T031)',
      reqTitle: 'Marketing Operations Lead (GTM - RevOps)',
      expMin: 1,
      expMax: 4,
      location: 'Bangalore',
      locationAddress: 'Bangalore',
      jdDisplay: 'Drive GTM automation, attribution, and pipeline reporting for Amagi.',
      approvedOn: '2026-06-24T06:18:53.452+0000',
      employmentType: 'full-time',
      locationGroup: ['India'],
      fresher: false,
    },
    {
      reqId: 362,
      statusId: 3,
      buName: 'Americas SaaS - Entertainment Account Mgmt-(T177)',
      reqTitle: 'Account Director',
      expMin: 5,
      expMax: 15,
      location: 'USA',
      locationAddress: 'USA',
      jdDisplay: 'Own strategic media accounts across the United States.',
      approvedOn: '2026-06-23T17:16:03.792+0000',
      employmentType: 'full-time',
      locationGroup: ['USA'],
      fresher: false,
    },
  ],
}

test('Amagi maps India jobs while a missing configured continuation keeps the fixture partial', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amagi')
  assert.ok(provider)

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url, options = {}) => {
      assert.equal(url, 'https://amagi.mynexthire.com/employer/careers/reqlist/get')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Content-Type'], 'application/json')
      assert.deepEqual(JSON.parse(options.body), {
        source: 'careers',
        code: '',
        filterByBuId: -1,
      })
      return listingsPayload
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Marketing Operations Lead (GTM - RevOps)',
    company: 'Amagi',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: jobs[0].link,
    applyUrl: jobs[0].applyUrl,
    sourceUrl: jobs[0].sourceUrl,
    source: 'amagi',
    jobId: 371,
    requisitionId: 371,
    department: 'Management - Revenue Operations and Strategy-(T031)',
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: '2026-06-24T06:18:53.452+0000',
    jobDescription: 'Drive GTM automation, attribution, and pipeline reporting for Amagi.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    experienceLevel: 'Mid Level',
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.reason, 'api-portal-incomplete-listing-or-role-details:configured-continuation-unavailable')
  assert.match(jobs[0].sourceUrl, /^https:\/\/amagi\.mynexthire\.com\/employer\/jobs\/careers\?src%3Dcareers/i)
  assert.equal(jobs[0].sourceUrl, jobs[0].link)
  assert.match(jobs[0].applyUrl, /^https:\/\/amagi\.mynexthire\.com\/employer\/jobs\/careers\/apply\?src%3Dcareers/i)
})
