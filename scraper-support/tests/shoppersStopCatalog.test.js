import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/shoppersstop/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shoppersstop/catalog.js')
  } catch {
    assert.fail('Expected Shoppers Stop catalog module at ../../scraper/shoppersstop/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shoppersstop/script.js')
  } catch {
    assert.fail('Expected Shoppers Stop scraper module at ../../scraper/shoppersstop/script.js')
  }
}

test('Shoppers Stop local catalog captures the verified first-party about-page Darwinbox handoff', async () => {
  const { SHOPPERS_STOP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shoppersStop = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHOPPERS_STOP_CATALOG)

  assert.equal(defaultCatalog, SHOPPERS_STOP_CATALOG)
  assert.equal(provider.source, 'shoppersstop')
  assert.equal(provider.companyName, 'Shoppers Stop')
  assert.equal(provider.officialBrandName, 'Shoppers Stop Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.shoppersstop.com/')
  assert.equal(provider.companyCareerPage, 'https://www.shoppersstop.com/miscs/aboutus')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://ss-people.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://ss-people.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.companyDomain, 'shoppersstop.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+darwinbox-public-candidate-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.dryRunFile, /shoppersstop[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.shoppersstop\.com\/miscs\/aboutus/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ss-people\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /redirects to the live official Shoppers Stop about page/i)
  assert.match(provider.verifiedSurfaceSummary, /beta\.shoppersstop\.com/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shoppers Stop'), false)

  assert.equal(shoppersStop.PROVIDER_METADATA.source, SHOPPERS_STOP_CATALOG.source)
  assert.equal(shoppersStop.PROVIDER_METADATA.companyName, SHOPPERS_STOP_CATALOG.companyName)
  assert.equal(
    shoppersStop.PROVIDER_METADATA.officialCareersHandoffUrl,
    SHOPPERS_STOP_CATALOG.officialCareersHandoffUrl,
  )
})

test('Shoppers Stop exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SHOPPERS_STOP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shoppers Stop\n',
    catalog: [hydrateProviderCatalogEntry(SHOPPERS_STOP_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shoppers Stop', 'shoppersstop', 'Shoppers Stop']],
  )
})
