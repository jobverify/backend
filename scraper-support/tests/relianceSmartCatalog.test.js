import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/reliancesmart/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/reliancesmart/catalog.js')
  } catch {
    assert.fail('Expected Reliance Smart catalog module at ../../scraper/reliancesmart/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/reliancesmart/script.js')
  } catch {
    assert.fail('Expected Reliance Smart scraper module at ../../scraper/reliancesmart/script.js')
  }
}

test('Reliance Smart local catalog captures the verified first-party brand page and no-public-careers sentinel surface', async () => {
  const { RELIANCE_SMART_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const relianceSmart = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(RELIANCE_SMART_CATALOG)

  assert.equal(defaultCatalog, RELIANCE_SMART_CATALOG)
  assert.equal(provider.source, 'reliancesmart')
  assert.equal(provider.companyName, 'Reliance Smart')
  assert.equal(provider.officialBrandName, 'Reliance SMART')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.relianceretail.com/')
  assert.equal(provider.companyCareerPage, 'https://www.relianceretail.com/reliance-smart.html')
  assert.deepEqual(provider.verified404Routes, [
    'https://www.relianceretail.com/careers',
    'https://www.relianceretail.com/careers/',
    'https://www.relianceretail.com/jobs',
    'https://www.relianceretail.com/jobs/',
  ])
  assert.equal(provider.companyDomain, 'relianceretail.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'brand-page-plus-common-careers-route-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-brand-page+verified-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /reliancesmart[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.relianceretail\.com\/reliance-smart\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.relianceretail\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Reliance Smart'), false)

  assert.equal(relianceSmart.PROVIDER_METADATA.source, RELIANCE_SMART_CATALOG.source)
  assert.equal(relianceSmart.PROVIDER_METADATA.companyName, RELIANCE_SMART_CATALOG.companyName)
  assert.deepEqual(relianceSmart.PROVIDER_METADATA.verified404Routes, RELIANCE_SMART_CATALOG.verified404Routes)
})

test('Reliance Smart backlog row matches directly from the local catalog without alias churn', async () => {
  const { RELIANCE_SMART_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Reliance Smart\n',
    catalog: [hydrateProviderCatalogEntry(RELIANCE_SMART_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Reliance Smart', 'reliancesmart', 'Reliance Smart']],
  )
})

test('Reliance Smart hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { RELIANCE_SMART_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RELIANCE_SMART_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Reliance Smart')
  assert.equal(provider.companyCareerPage, 'https://www.relianceretail.com/reliance-smart.html')
  assert.equal(provider.companyDomain, 'relianceretail.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /reliancesmart[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /reliancesmart[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
