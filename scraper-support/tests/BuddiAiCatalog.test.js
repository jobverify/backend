import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/buddiai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/buddiai/catalog.js')
  } catch {
    assert.fail('Expected BUDDI.AI catalog module at ../../scraper/buddiai/catalog.js')
  }
}

test('BUDDI.AI catalog captures the verified first-party static careers roles page', async () => {
  const { BUDDI_AI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BUDDI_AI_CATALOG)

  assert.equal(defaultCatalog, BUDDI_AI_CATALOG)
  assert.equal(provider.source, 'buddiai')
  assert.equal(provider.companyName, 'BUDDI.AI')
  assert.equal(provider.officialBrandName, 'BUDDI.AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://buddi.ai/')
  assert.equal(provider.companyCareerPage, 'https://buddi.ai/careers.html')
  assert.equal(provider.companyDomain, 'buddi.ai')
  assert.equal(provider.atsPlatform, 'official-first-party-static-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(provider.extractionStrategy, 'static-blurbs-and-role-sections+india-location-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /buddiai[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Team Leader/i)
  assert.match(provider.verifiedSurfaceSummary, /Medical Coders/i)
  assert.match(provider.verifiedSurfaceSummary, /Principle Software/i)
  assert.match(provider.verifiedSurfaceSummary, /blurbs-based layout/i)
})
