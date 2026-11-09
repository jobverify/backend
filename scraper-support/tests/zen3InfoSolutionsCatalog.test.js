import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/zen3infosolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/zen3infosolutions/catalog.js')
  } catch {
    assert.fail('Expected Zen3 Info Solutions catalog module at ../../scraper/zen3infosolutions/catalog.js')
  }
}

test('Zen3 Info Solutions local catalog captures the official homepage with no trustworthy first-party careers surface', async () => {
  const { ZEN3_INFO_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ZEN3_INFO_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, ZEN3_INFO_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'zen3infosolutions')
  assert.equal(provider.companyName, 'Zen3 Info Solutions')
  assert.equal(provider.officialBrandName, 'zen3')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://zen3.com/')
  assert.equal(provider.companyDomain, 'zen3.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-first-party-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-careers-routes+no-public-job-signals',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /hyderabad, india/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /zen3infosolutions[\\/]jobs\.json$/i)
})
