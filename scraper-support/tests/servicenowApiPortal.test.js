import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'servicenow',
)

const readFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const buildListingsFixture = (name, index) => {
  const payload = readFixture(name)
  const job = payload.content[index]

  return {
    ...payload,
    content: [job],
    totalFound: 11,
  }
}

test('ServiceNow maps and paginates the retained roles while its two-row excerpt remains partial against total eleven', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'servicenow')
  assert.ok(provider)

  const pageOne = buildListingsFixture('search-page-1.json', 1)
  const pageTwo = buildListingsFixture('search-page-2.json', 1)
  const firstDetail = readFixture('posting-744000134466099.json')
  const secondDetail = {
    ...firstDetail,
    id: '744000129443659',
    name: 'Principal Product Designer, Moveworks',
    refNumber: 'JB0072991',
    releasedDate: '2026-06-03T10:10:17.417Z',
    postingUrl: 'https://www.smartrecruiters.com/ServiceNow/744000129443659-principal-product-designer-moveworks',
    applyUrl: 'https://jobs.smartrecruiters.com/ServiceNow/744000129443659-principal-product-designer-moveworks?oga=true',
    location: {
      ...firstDetail.location,
      city: 'Bangalore',
      region: 'Karnataka',
      fullLocation: 'Bangalore, Karnataka, India',
    },
    department: {
      ...firstDetail.department,
      label: 'User Experience',
    },
  }
  const requests = []

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      requests.push(url)

      if (url === 'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings?limit=10&country=in&offset=0') {
        return pageOne
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings/744000134466099') {
        return firstDetail
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings?limit=10&country=in&offset=10') {
        return pageTwo
      }

      if (url === 'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings/744000129443659') {
        return secondDetail
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings?limit=10&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings/744000134466099',
    'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings?limit=10&country=in&offset=10',
    'https://api.smartrecruiters.com/v1/companies/ServiceNow/postings/744000129443659',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Principal Applications Dev Engineer_UI',
    company: 'ServiceNow',
    location: 'Hyderabad, , India',
    city: 'Hyderabad',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/ServiceNow/744000134466099-principal-applications-dev-engineer-ui',
    applyUrl: 'https://jobs.smartrecruiters.com/ServiceNow/744000134466099-principal-applications-dev-engineer-ui?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/ServiceNow/744000134466099-principal-applications-dev-engineer-ui',
    source: 'servicenow',
    jobId: '744000134466099',
    requisitionId: 'JB0073281',
    department: 'Engineering, Infrastructure and Operations',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Not Applicable',
    postingDate: '2026-06-26T12:48:21.759Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
    sourceListingComplete: false,
  })
  const evidence = readInventoryEvidence(jobs)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 11)
  assert.equal(evidence.pagesFetched, 2)
  assert.equal(evidence.reason, 'api-portal-incomplete-listing-or-role-details:upstream-count-mismatch')

  assert.match(jobs[0].jobDescription, /Role Overview/i)
  assert.match(jobs[0].minimumQualification, /10\+ years of software engineering experience/i)
  assert.match(jobs[0].preferredQualification, /Work Personas/i)
  assert.equal(jobs[1].jobId, '744000129443659')
  assert.equal(jobs[1].location, 'Bangalore, Karnataka, India')
  assert.equal(jobs[1].city, 'Bangalore')
  assert.equal(jobs[1].department, 'User Experience')
  assert.equal(jobs[1].requisitionId, 'JB0072991')
})
