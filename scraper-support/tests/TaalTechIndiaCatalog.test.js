import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/taaltechindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/taaltechindia/catalog.js')
  } catch {
    assert.fail('Expected TAAL Tech India catalog module at ../../scraper/taaltechindia/catalog.js')
  }
}

test('TAAL Tech India catalog captures the verified first-party paged jobs archive', async () => {
  const { TAAL_TECH_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TAAL_TECH_INDIA_CATALOG)

  assert.equal(defaultCatalog, TAAL_TECH_INDIA_CATALOG)
  assert.equal(provider.source, 'taaltechindia')
  assert.equal(provider.companyName, 'Taal Tech India')
  assert.equal(provider.officialBrandName, 'TAAL Tech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.taaltech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.taaltech.com/careers/')
  assert.equal(provider.companyDomain, 'taaltech.com')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-archive')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paged-wordpress-jobs-archive-until-no-jobs-found')
  assert.equal(
    provider.extractionStrategy,
    'jobs-archive-listings+detail-pages+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /taaltechindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Jobs Archive/i)
  assert.match(provider.verifiedSurfaceSummary, /Civil and Structural designer/i)
  assert.match(provider.verifiedSurfaceSummary, /Piping Designers/i)
  assert.match(provider.verifiedSurfaceSummary, /timing out/i)
})
