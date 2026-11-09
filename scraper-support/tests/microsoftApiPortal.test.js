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
  'microsoft',
)

const readFixture = (name) =>
  JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('runApiPortalScraper maps Microsoft India Eightfold jobs with the public ten-result page size', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'microsoft')
  assert.ok(provider)
  const firstPage = readFixture('search-page-1.json')
  const secondPage = readFixture('search-page-2.json')
  const combinedFirstPage = {
    ...firstPage,
    data: {
      ...firstPage.data,
      count: 2,
      positions: [
        ...(firstPage.data?.positions ?? []),
        ...(secondPage.data?.positions ?? []),
      ],
    },
  }

  const requests = []
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      requests.push(url)

      if (url === 'https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=India&sort_by=timestamp&start=0&limit=10') {
        return combinedFirstPage
      }

      if (url === 'https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=1970393556911730&domain=microsoft.com&hl=en&queried_location=India') {
        return readFixture('position-details-1970393556911730.json')
      }

      if (url === 'https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=1970393556750481&domain=microsoft.com&hl=en&queried_location=India') {
        return readFixture('position-details-1970393556750481.json')
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    'https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=&location=India&sort_by=timestamp&start=0&limit=10',
    'https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=1970393556911730&domain=microsoft.com&hl=en&queried_location=India',
    'https://apply.careers.microsoft.com/api/pcsx/position_details?position_id=1970393556750481&domain=microsoft.com&hl=en&queried_location=India',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineering INTERN',
    company: 'Microsoft',
    location: 'India, Multiple Locations, Multiple Locations',
    city: null,
    country: 'India',
    link: 'https://apply.careers.microsoft.com/careers/job/1970393556911730',
    applyUrl: 'https://apply.careers.microsoft.com/careers/job/1970393556911730',
    sourceUrl: 'https://apply.careers.microsoft.com/careers/job/1970393556911730',
    source: 'microsoft',
    jobId: 1970393556911730,
    requisitionId: '200041085',
    department: 'Software Engineering',
    employmentType: 'Internship',
    experienceRequired: null,
    postingDate: 1782202606,
    jobDescription: '<b>Overview</b><br><p>Come build community, explore your passions and do your best work at Microsoft with thousands of University interns from every corner of the world.</p>',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.equal(jobs[1].title, 'Senior Software Engineer')
  assert.equal(jobs[1].location, 'Bengaluru, KA, IN')
  assert.equal(jobs[1].city, 'Bengaluru')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].requisitionId, '200024622')
})

test('Microsoft advances by ten returned jobs and retries a temporary 429', async () => {
  const catalogProvider = getScraperCatalog().find((item) => item.source === 'microsoft')
  const provider = {
    ...catalogProvider,
    config: {
      ...catalogProvider.config,
      detail: { ...catalogProvider.config.detail, enabled: false },
      rateLimit: { minimumIntervalMs: 0, maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 },
    },
  }
  const records = Array.from({ length: 11 }, (_, index) => ({
    id: index + 1,
    name: `Role ${index + 1}`,
    locations: ['India'],
    data: { publicUrl: `https://apply.careers.microsoft.com/careers/job/${index + 1}` },
  }))
  const offsets = []
  let retried = false
  const jobs = await runApiPortalScraper({
    provider,
    fetchJson: async (url) => {
      const offset = Number(new URL(url).searchParams.get('start'))
      offsets.push(offset)
      if (offset === 10 && !retried) {
        retried = true
        throw new Error(`HTTP 429 for ${url}`)
      }
      return { data: { count: records.length, positions: records.slice(offset, offset + 10) } }
    },
  })
  assert.deepEqual(offsets, [0, 10, 10])
  assert.equal(jobs.length, 11)
  assert.equal(jobs.at(-1).title, 'Role 11')
})
