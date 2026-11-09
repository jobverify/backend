import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const lgElectronicsIndiaModulePath = path.resolve(currentDir, '../../scraper/lgelectronicsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lgelectronicsindia/catalog.js')
  } catch {
    assert.fail('Expected LG Electronics India catalog module at ../../scraper/lgelectronicsindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lgelectronicsindia/script.js')
  } catch {
    assert.fail('Expected LG Electronics India scraper module at ../../scraper/lgelectronicsindia/script.js')
  }
}

test('LG Electronics India local catalog captures the verified exact-name careers page and first-party jobs API without alias churn', async () => {
  const {
    LG_ELECTRONICS_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const lgElectronicsIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LG_ELECTRONICS_INDIA_CATALOG)

  assert.equal(defaultCatalog, LG_ELECTRONICS_INDIA_CATALOG)
  assert.equal(provider.source, 'lgelectronicsindia')
  assert.equal(provider.companyName, 'LG Electronics India')
  assert.equal(provider.officialBrandName, 'LG Electronics India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://globalcareers.lge.com/locations/IN')
  assert.equal(provider.companyDomain, 'globalcareers.lge.com')
  assert.equal(provider.atsPlatform, 'official-company-site-plus-first-party-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'browser-validated-india-location-page-plus-paged-first-party-jobs-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'browser-validated-lg-india-location-page+verified-first-party-jobs-api+india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.dryRunFile, /lgelectronicsindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, lgElectronicsIndiaModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/globalcareers\.lge\.com\/locations\/IN/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/globalcareers\.lge\.com\/api\/job\/v1\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /LG Electronics branding/i)
  assert.match(provider.verifiedSurfaceSummary, /Explore Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Equal Opportunity/i)
  assert.match(provider.verifiedSurfaceSummary, /IT Infra & Security\/Maintenance - AM\/DM/i)
  assert.match(provider.verifiedSurfaceSummary, /Autosar Dev_VS/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LG Electronics India'), false)

  assert.equal(
    lgElectronicsIndia.PROVIDER_METADATA.source,
    LG_ELECTRONICS_INDIA_CATALOG.source,
  )
  assert.equal(
    lgElectronicsIndia.PROVIDER_METADATA.companyName,
    LG_ELECTRONICS_INDIA_CATALOG.companyName,
  )
  assert.equal(
    lgElectronicsIndia.PROVIDER_METADATA.companyCareerPage,
    LG_ELECTRONICS_INDIA_CATALOG.companyCareerPage,
  )
})

test('LG Electronics India backlog row matches directly from the local catalog without alias churn', async () => {
  const { LG_ELECTRONICS_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'LG Electronics India\n',
    catalog: [hydrateProviderCatalogEntry(LG_ELECTRONICS_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LG Electronics India', 'lgelectronicsindia', 'LG Electronics India']],
  )
})
