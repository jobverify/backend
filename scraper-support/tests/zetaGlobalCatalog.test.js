import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/zetaglobal/script.js')

const greenhousePayload = {
  jobs: [
    {
      id: 5557459004,
      title: 'Lead Software Engineer, Identity',
      absolute_url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5557459004',
      first_published: '2026-07-17T10:00:00Z',
      content: '<p>Build core identity systems.</p>',
      location: { name: 'Bangalore, Karnataka, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Bangalore, Karnataka, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      id: 5557460005,
      title: 'ML Ops Engineer',
      absolute_url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5557460005',
      first_published: '2026-07-16T10:00:00Z',
      content: '<p>Build ML platform systems.</p>',
      location: { name: 'Hyderabad, Telangana, India' },
      departments: [{ name: 'Engineering' }],
      offices: [{ location: 'Hyderabad, Telangana, India' }],
      metadata: [{ name: 'Country', value: ['India'] }],
    },
    {
      id: 5557460006,
      title: 'Associate Account Director',
      absolute_url: 'https://job-boards.greenhouse.io/zetaglobal/jobs/5557460006',
      first_published: '2026-07-16T10:00:00Z',
      content: '<p>US role.</p>',
      location: { name: 'Chicago, Illinois, United States' },
      departments: [{ name: 'Client Management' }],
      offices: [{ location: 'Chicago, Illinois, United States' }],
      metadata: [{ name: 'Country', value: ['United States'] }],
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/zetaglobal/catalog.js')
  } catch {
    assert.fail('Expected Zeta Global catalog module at ../../scraper/zetaglobal/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/zetaglobal/script.js')
  } catch {
    assert.fail('Expected Zeta Global scraper module at ../../scraper/zetaglobal/script.js')
  }
}

test('Zeta Global catalog captures the official careers handoff to the public Greenhouse board', async () => {
  const { ZETA_GLOBAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, ZETA_GLOBAL_CATALOG)
  assert.equal(ZETA_GLOBAL_CATALOG.source, 'zetaglobal')
  assert.equal(ZETA_GLOBAL_CATALOG.companyName, 'Zeta Global')
  assert.equal(ZETA_GLOBAL_CATALOG.adapter, 'script')
  assert.equal(ZETA_GLOBAL_CATALOG.companyCareerPage, 'https://zetaglobal.com/about/benefits-and-hiring/')
  assert.equal(ZETA_GLOBAL_CATALOG.companyDomain, 'zetaglobal.com')
  assert.equal(ZETA_GLOBAL_CATALOG.atsPlatform, 'greenhouse-board-api')
  assert.equal(ZETA_GLOBAL_CATALOG.countryFilter, 'India')
  assert.equal(
    ZETA_GLOBAL_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  )
  assert.equal(ZETA_GLOBAL_CATALOG.verifiedOn, '2026-07-18')
  assert.equal(ZETA_GLOBAL_CATALOG.modulePath, modulePath)
  assert.match(ZETA_GLOBAL_CATALOG.verifiedSurfaceSummary, /View Open Jobs/i)
  assert.match(ZETA_GLOBAL_CATALOG.verifiedSurfaceSummary, /job-boards\.greenhouse\.io\/zetaglobal/i)
})

test('Zeta Global scraper keeps only India roles from the official Greenhouse board', async () => {
  const zetaGlobal = await loadScriptModule()

  assert.equal(zetaGlobal.isIndiaJob(greenhousePayload.jobs[0]), true)
  assert.equal(zetaGlobal.isIndiaJob(greenhousePayload.jobs[1]), true)
  assert.equal(zetaGlobal.isIndiaJob(greenhousePayload.jobs[2]), false)

  const jobs = await zetaGlobal.createZetaGlobalScraper().run({
    fetchJson: async () => greenhousePayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department]),
    [
      ['Lead Software Engineer, Identity', 'Bangalore, Karnataka, India', 'Engineering'],
      ['ML Ops Engineer', 'Hyderabad, Telangana, India', 'Engineering'],
    ],
  )
})
