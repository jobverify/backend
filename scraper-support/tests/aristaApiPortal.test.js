import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'arista',
)

const readJsonFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const buildListingsFixture = () => {
  const payload = readJsonFixture('postings-page-1.json')
  const indiaJobs = payload.content.filter((job) => /india/i.test(job.location?.fullLocation || ''))

  return {
    ...payload,
    content: [indiaJobs[0], indiaJobs[2]],
    totalFound: 2,
  }
}

test('runApiPortalScraper maps Arista SmartRecruiters jobs and keeps India roles with detail enrichment', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arista')
  assert.ok(provider)

  const listingsPayload = buildListingsFixture()
  const firstDetail = readJsonFixture('posting-744000132384890.json')
  const secondDetail = {
    ...firstDetail,
    id: '744000132384629',
    refNumber: 'REF3198W',
    location: {
      ...firstDetail.location,
      city: 'Pune',
      region: 'MH',
      fullLocation: 'Pune, MH, India',
    },
    releasedDate: '2026-06-16T10:30:51.890Z',
    postingUrl: 'https://jobs.smartrecruiters.com/AristaNetworks/744000132384629-software-engineer-wifi-embedded-',
    applyUrl: 'https://jobs.smartrecruiters.com/AristaNetworks/744000132384629-software-engineer-wifi-embedded-?oga=true',
    department: {
      ...firstDetail.department,
      label: 'Software Engineering',
    },
  }

  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      if (url.includes('/companies/AristaNetworks/postings?')) return listingsPayload
      if (url.endsWith('/postings/744000132384890')) return firstDetail
      if (url.endsWith('/postings/744000132384629')) return secondDetail
      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer (Wifi/ Embedded)',
    company: 'Arista Networks',
    location: 'Chennai, TN, India',
    city: 'Chennai',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/AristaNetworks/744000132384890-software-engineer-wifi-embedded-',
    applyUrl: 'https://jobs.smartrecruiters.com/AristaNetworks/744000132384890-software-engineer-wifi-embedded-?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/AristaNetworks/744000132384890-software-engineer-wifi-embedded-',
    source: 'arista',
    jobId: '744000132384890',
    requisitionId: 'REF3199X',
    department: 'Software Engineering',
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Mid-Senior Level',
    postingDate: '2026-06-16T10:32:06.071Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription, /WiFi team at Arista/i)
  assert.match(jobs[0].minimumQualification, /Minimum 6-15/i)
  assert.match(jobs[0].preferredQualification, /engineering-centric company/i)
  assert.equal(jobs[1].jobId, '744000132384629')
  assert.equal(jobs[1].location, 'Pune, MH, India')
  assert.equal(jobs[1].city, 'Pune')
  assert.equal(jobs[1].requisitionId, 'REF3198W')
})
