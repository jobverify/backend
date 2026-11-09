import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cnsi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cnsi/catalog.js')
  } catch {
    assert.fail('Expected CNSI catalog module at ../../scraper/cnsi/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cnsi/script.js')
  } catch {
    assert.fail('Expected CNSI scraper module at ../../scraper/cnsi/script.js')
  }
}

test('CNSI local catalog captures the verified fail-closed sentinel for unavailable official domains', async () => {
  const { CNSI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const cnsi = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CNSI_CATALOG)

  assert.equal(defaultCatalog, CNSI_CATALOG)
  assert.equal(provider.source, 'cnsi')
  assert.equal(provider.companyName, 'CNSI')
  assert.equal(provider.officialBrandName, 'CNSI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cnsi.com/')
  assert.equal(provider.legacyHomepageUrl, 'http://www.cns-inc.com/')
  assert.equal(provider.companyDomain, 'cnsi.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-domains-unreachable-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-domains-unreachable-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cnsi[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cnsi\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /http:\/\/www\.cns-inc\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy current first-party public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CNSI'), false)

  assert.equal(cnsi.PROVIDER_METADATA.source, CNSI_CATALOG.source)
  assert.equal(cnsi.PROVIDER_METADATA.companyCareerPage, CNSI_CATALOG.companyCareerPage)
})

test('CNSI exact backlog row matches directly from local metadata without alias churn', async () => {
  const { CNSI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'CNSI\n',
    catalog: [hydrateProviderCatalogEntry(CNSI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CNSI', 'cnsi', 'CNSI']],
  )
})

test('CNSI hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { CNSI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CNSI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CNSI')
  assert.match(provider.modulePath, /cnsi[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cnsi[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
