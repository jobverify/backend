import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/webkulsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/webkulsoftware/catalog.js')
  } catch {
    assert.fail('Expected Webkul Software catalog module at ../../scraper/webkulsoftware/catalog.js')
  }
}

test('Webkul Software local catalog captures the verified first-party jobs pages and detail-page contract', async () => {
  const { WEBKUL_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(WEBKUL_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, WEBKUL_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'webkulsoftware')
  assert.equal(provider.companyName, 'Webkul Software')
  assert.equal(provider.officialBrandName, 'Webkul Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://webkul.com/jobs/')
  assert.equal(provider.companyDomain, 'webkul.com')
  assert.equal(provider.jobsPageUrl, 'https://webkul.com/jobs/')
  assert.equal(provider.atsPlatform, 'official-company-site-jobs-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-page-html')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+detail-pages+inline-open-position-cards-or-current-empty-shell',
  )
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /category tabs/i)
  assert.match(provider.verifiedSurfaceSummary, /honest empty result/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /webkulsoftware[\\/]jobs\.json$/i)
})
