import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tradingo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tradingo/catalog.js')
  } catch {
    assert.fail('Expected Tradingo catalog module at ../../scraper/tradingo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tradingo/script.js')
  } catch {
    assert.fail('Expected Tradingo scraper module at ../../scraper/tradingo/script.js')
  }
}

test('Tradingo local catalog captures the verified first-party public role cards and shared apply form', async () => {
  const { TRADINGO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tradingo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TRADINGO_CATALOG)

  assert.equal(defaultCatalog, TRADINGO_CATALOG)
  assert.equal(provider.source, 'tradingo')
  assert.equal(provider.companyName, 'Tradingo')
  assert.equal(provider.officialBrandName, 'Tradingo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.gotradingo.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.gotradingo.com/careers')
  assert.equal(
    provider.applicationFormUrl,
    'https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url',
  )
  assert.equal(provider.companyDomain, 'gotradingo.com')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-role-cards+shared-google-form-apply-route',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /tradingo[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gotradingo\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Acquisition Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Relationship Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /docs\.google\.com\/forms/i)
  assert.match(provider.verifiedSurfaceSummary, /no explicit per-role location/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tradingo'), false)

  assert.equal(tradingo.PROVIDER_METADATA.source, TRADINGO_CATALOG.source)
  assert.equal(tradingo.PROVIDER_METADATA.companyName, TRADINGO_CATALOG.companyName)
})

test('Tradingo exact backlog row matches directly from local provider metadata', async () => {
  const { TRADINGO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tradingo\n',
    catalog: [hydrateProviderCatalogEntry(TRADINGO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tradingo', 'tradingo', 'Tradingo']],
  )
})

test('Tradingo hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { TRADINGO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TRADINGO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tradingo')
  assert.equal(provider.companyCareerPage, 'https://www.gotradingo.com/careers')
  assert.equal(provider.companyDomain, 'gotradingo.com')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.match(provider.modulePath, /tradingo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tradingo[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
