import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tradejini/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tradejini/catalog.js')
  } catch {
    assert.fail('Expected TradeJini catalog module at ../../scraper/tradejini/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tradejini/script.js')
  } catch {
    assert.fail('Expected TradeJini scraper module at ../../scraper/tradejini/script.js')
  }
}

test('TradeJini local catalog captures the verified first-party careers sentinel surface', async () => {
  const { TRADE_JINI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tradeJini = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TRADE_JINI_CATALOG)

  assert.equal(defaultCatalog, TRADE_JINI_CATALOG)
  assert.equal(provider.source, 'tradejini')
  assert.equal(provider.companyName, 'TradeJini')
  assert.equal(provider.officialBrandName, 'Tradejini Financial Services Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tradejini.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.tradejini.com/careers')
  assert.equal(provider.officialOpenPositionsUrl, 'https://www.tradejini.com/careers/open-positions')
  assert.equal(provider.companyDomain, 'tradejini.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-shell-no-public-job-records')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-open-positions-route',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-open-positions-route+return-empty-when-no-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /tradejini[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tradejini\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tradejini\.com\/careers\/open-positions/i)
  assert.match(provider.verifiedSurfaceSummary, /no public job records/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TradeJini'), false)

  assert.equal(tradeJini.PROVIDER_METADATA.source, TRADE_JINI_CATALOG.source)
  assert.equal(tradeJini.PROVIDER_METADATA.companyName, TRADE_JINI_CATALOG.companyName)
  assert.equal(
    tradeJini.PROVIDER_METADATA.officialOpenPositionsUrl,
    TRADE_JINI_CATALOG.officialOpenPositionsUrl,
  )
})

test('TradeJini exact backlog row matches directly from local provider metadata', async () => {
  const { TRADE_JINI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TradeJini\n',
    catalog: [hydrateProviderCatalogEntry(TRADE_JINI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TradeJini', 'tradejini', 'TradeJini']],
  )
})

test('TradeJini hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { TRADE_JINI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TRADE_JINI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TradeJini')
  assert.equal(provider.companyCareerPage, 'https://www.tradejini.com/careers')
  assert.equal(provider.companyDomain, 'tradejini.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-shell-no-public-job-records')
  assert.match(provider.modulePath, /tradejini[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tradejini[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
