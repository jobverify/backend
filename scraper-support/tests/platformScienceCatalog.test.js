import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/platformscience/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/platformscience/catalog.js')
  } catch {
    assert.fail('Expected Platform Science catalog module at ../../scraper/platformscience/catalog.js')
  }
}

test('Platform Science local catalog captures the verified first-party jobs page and Greenhouse feed', async () => {
  const { PLATFORM_SCIENCE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PLATFORM_SCIENCE_CATALOG)

  assert.equal(defaultCatalog, PLATFORM_SCIENCE_CATALOG)
  assert.equal(provider.source, 'platformscience')
  assert.equal(provider.companyName, 'Platform Science')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.platformscience.com/jobs')
  assert.equal(provider.companyDomain, 'platformscience.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+official-greenhouse-board-api+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Developer - India/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Quality Engineer \(Automation\) - India/i)
})
