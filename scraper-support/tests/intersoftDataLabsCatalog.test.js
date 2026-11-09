import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/intersoftdatalabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/intersoftdatalabs/catalog.js')
  } catch {
    assert.fail('Expected Intersoft Data Labs catalog module at ../../scraper/intersoftdatalabs/catalog.js')
  }
}

test('Intersoft Data Labs local catalog captures the verified first-party openings page and email handoff', async () => {
  const { INTERSOFT_DATA_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(INTERSOFT_DATA_LABS_CATALOG)

  assert.equal(defaultCatalog, INTERSOFT_DATA_LABS_CATALOG)
  assert.equal(provider.source, 'intersoftdatalabs')
  assert.equal(provider.companyName, 'Intersoft Data Labs')
  assert.equal(provider.officialBrandName, 'Intersoft Data Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://intsof.com/careers/')
  assert.equal(provider.companyDomain, 'intsof.com')
  assert.equal(provider.atsPlatform, 'official-company-site-inline-openings-email-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-toggle-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+toggle-job-openings+resume-email-handoff',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /career@intsof\.com/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /intersoftdatalabs[\\/]jobs\.json$/i)
})
