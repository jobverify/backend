import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/liquidhub/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/liquidhub/catalog.js')
  } catch {
    assert.fail('Expected LiquidHub catalog module at ../../scraper/liquidhub/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/liquidhub/script.js')
  } catch {
    assert.fail('Expected LiquidHub scraper module at ../../scraper/liquidhub/script.js')
  }
}

test('LiquidHub local catalog captures the verified exact-name redirect to Capgemini and fail-closed sentinel state', async () => {
  const { LIQUIDHUB_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const liquidhub = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LIQUIDHUB_CATALOG)

  assert.equal(defaultCatalog, LIQUIDHUB_CATALOG)
  assert.equal(provider.source, 'liquidhub')
  assert.equal(provider.companyName, 'LiquidHub')
  assert.equal(provider.officialBrandName, 'LiquidHub')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.liquidhub.com/')
  assert.equal(provider.redirectedHomepageUrl, 'https://www.capgemini.com/')
  assert.equal(provider.companyDomain, 'liquidhub.com')
  assert.equal(provider.atsPlatform, 'exact-name-domain-redirect-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-exact-name-root-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-root-redirect-to-capgemini+no-public-jobs-on-exact-name-domain-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /liquidhub[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.liquidhub\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.capgemini\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LiquidHub'), false)

  assert.equal(liquidhub.PROVIDER_METADATA.source, LIQUIDHUB_CATALOG.source)
  assert.equal(liquidhub.PROVIDER_METADATA.companyName, LIQUIDHUB_CATALOG.companyName)
})

test('LiquidHub exact backlog row matches directly from local provider metadata', async () => {
  const { LIQUIDHUB_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'LiquidHub\n',
    catalog: [hydrateProviderCatalogEntry(LIQUIDHUB_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LiquidHub', 'liquidhub', 'LiquidHub']],
  )
})

test('LiquidHub hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { LIQUIDHUB_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LIQUIDHUB_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'LiquidHub')
  assert.equal(provider.companyCareerPage, 'https://www.liquidhub.com/')
  assert.equal(provider.companyDomain, 'liquidhub.com')
  assert.equal(provider.atsPlatform, 'exact-name-domain-redirect-no-public-jobs')
  assert.match(provider.modulePath, /liquidhub[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /liquidhub[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
