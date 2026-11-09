import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/6sense/script.js')

const samplePayload = {
  jobs: [
    {
      absolute_url: 'https://boards.greenhouse.io/6sense/jobs/8000001?gh_jid=8000001',
      id: 8000001,
      requisition_id: 'JR-1001111',
      title: 'Principal Architect',
      company_name: '6sense',
      first_published: '2026-07-15T10:34:52-04:00',
      content: '<p>Architecture role for India.</p>',
      location: { name: 'Bengaluru, Karnataka, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bengaluru, Karnataka, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      absolute_url: 'https://boards.greenhouse.io/6sense/jobs/8000002?gh_jid=8000002',
      id: 8000002,
      requisition_id: 'JR-1001112',
      title: 'Manager, Campaign Operations',
      company_name: '6sense',
      first_published: '2026-07-15T10:34:52-04:00',
      content: '<p>Campaign operations role for India.</p>',
      location: { name: 'Pune, Maharashtra, India' },
      departments: [{ name: 'Product Management' }],
      offices: [{ location: 'Pune, Maharashtra, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      absolute_url: 'https://boards.greenhouse.io/6sense/jobs/8000003?gh_jid=8000003',
      id: 8000003,
      requisition_id: 'JR-1001113',
      title: 'Enterprise Account Executive',
      company_name: '6sense',
      first_published: '2026-07-15T10:34:52-04:00',
      content: '<p>US remote sales role.</p>',
      location: { name: 'United States, Remote' },
      departments: [{ name: 'Sales' }],
      offices: [{ location: 'United States, Remote' }],
      metadata: [{ name: 'Country', value: ['United States of America'] }],
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/6sense/catalog.js')
  } catch {
    assert.fail('Expected 6sense catalog module at ../../scraper/6sense/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/6sense/script.js')
  } catch {
    assert.fail('Expected 6sense scraper module at ../../scraper/6sense/script.js')
  }
}

test('6sense local catalog captures the verified first-party careers handoff to Greenhouse', async () => {
  const { SIX_SENSE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIX_SENSE_CATALOG)

  assert.equal(defaultCatalog, SIX_SENSE_CATALOG)
  assert.equal(provider.source, '6sense')
  assert.equal(provider.companyName, '6sense')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://6sense.com/about-us/careers/join-us/')
  assert.equal(provider.companyDomain, '6sense.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Principal Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Manager, Campaign Operations/i)
})

test('6sense scraper keeps only India roles from the official Greenhouse feed', async () => {
  const sixSense = await loadScriptModule()

  assert.equal(sixSense.isIndiaJob(samplePayload.jobs[0]), true)
  assert.equal(sixSense.isIndiaJob(samplePayload.jobs[1]), true)
  assert.equal(sixSense.isIndiaJob(samplePayload.jobs[2]), false)

  const extractedJobs = sixSense.extractJobsFromGreenhousePayload(samplePayload)
  assert.equal(extractedJobs.length, 2)

  const jobs = await sixSense.createSixSenseScraper().run({
    fetchJson: async () => samplePayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country]),
    [
      ['Principal Architect', 'Bengaluru, Karnataka, India', 'Engineering', 'India'],
      ['Manager, Campaign Operations', 'Pune, Maharashtra, India', 'Product Management', 'India'],
    ],
  )
})
