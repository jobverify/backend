import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sisense/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sisense/catalog.js')
  } catch {
    assert.fail('Expected Sisense catalog module at ../../scraper/sisense/catalog.js')
  }
}

test('Sisense catalog captures the verified first-party careers handoff to the official Ashby board', async () => {
  const { SISENSE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SISENSE_CATALOG)

  assert.equal(defaultCatalog, SISENSE_CATALOG)
  assert.equal(provider.source, 'sisense')
  assert.equal(provider.companyName, 'Sisense')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sisense.com/about/careers/')
  assert.equal(provider.companyDomain, 'sisense.com')
  assert.equal(provider.atsPlatform, 'ashby-job-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-ashby-job-board-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-ashby-board+official-ashby-job-board-api+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-09-12')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /September 12, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\.ashbyhq\.com\/sisense/i)
  assert.match(provider.verifiedSurfaceSummary, /api\.ashbyhq\.com\/posting-api\/job-board\/sisense/i)
  assert.match(provider.verifiedSurfaceSummary, /honest empty set/i)
})

test('Sisense is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sisense')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sisense[\\/]jobs\.json$/i)
})
