import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smartcoin/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smartcoin/catalog.js')
  } catch {
    assert.fail('Expected SmartCoin catalog module at ../../scraper/smartcoin/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/smartcoin/script.js')
  } catch {
    assert.fail('Expected SmartCoin scraper module at ../../scraper/smartcoin/script.js')
  }
}

test('SmartCoin local catalog captures the verified Olyv first-party page and fail-closed Keka handoff state', async () => {
  const { SMARTCOIN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const smartcoin = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SMARTCOIN_CATALOG)

  assert.equal(defaultCatalog, SMARTCOIN_CATALOG)
  assert.equal(provider.source, 'smartcoin')
  assert.equal(provider.companyName, 'SmartCoin')
  assert.equal(provider.officialBrandName, 'SmartCoin Financials Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.olyv.co.in/about-us')
  assert.equal(provider.officialCareersPageUrl, 'https://www.olyv.co.in/about-us')
  assert.equal(provider.officialCareersHandoffUrl, 'https://smartcoin.keka.com/careers')
  assert.equal(provider.companyDomain, 'olyv.co.in')
  assert.equal(provider.atsPlatform, 'keka-handoff-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-about-page-plus-external-keka-handoff-no-verifiable-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+verified-keka-handoff+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /smartcoin[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.olyv\.co\.in\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/smartcoin\.keka\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SmartCoin'), false)

  assert.equal(smartcoin.PROVIDER_METADATA.source, SMARTCOIN_CATALOG.source)
  assert.equal(smartcoin.PROVIDER_METADATA.companyName, SMARTCOIN_CATALOG.companyName)
})

test('SmartCoin exact backlog row matches directly from the local provider metadata', async () => {
  const { SMARTCOIN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SmartCoin\n',
    catalog: [hydrateProviderCatalogEntry(SMARTCOIN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SmartCoin', 'smartcoin', 'SmartCoin']],
  )
})

test('SmartCoin hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SMARTCOIN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMARTCOIN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SmartCoin')
  assert.equal(provider.companyCareerPage, 'https://www.olyv.co.in/about-us')
  assert.equal(provider.companyDomain, 'olyv.co.in')
  assert.equal(provider.atsPlatform, 'keka-handoff-unverifiable')
  assert.match(provider.modulePath, /smartcoin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /smartcoin[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
