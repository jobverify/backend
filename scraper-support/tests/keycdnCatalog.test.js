import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const keycdnModulePath = path.resolve(currentDir, '../../scraper/keycdn/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/keycdn/catalog.js')
  } catch {
    assert.fail('Expected KeyCDN catalog module at ../../scraper/keycdn/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/keycdn/script.js')
  } catch {
    assert.fail('Expected KeyCDN scraper module at ../../scraper/keycdn/script.js')
  }
}

test('KeyCDN local catalog captures the verified first-party careers sentinel contract', async () => {
  const { KEYCDN_CATALOG } = await loadCatalogModule()
  const keycdn = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KEYCDN_CATALOG)

  assert.equal(provider.source, 'keycdn')
  assert.equal(provider.companyName, 'KeyCDN')
  assert.equal(provider.officialBrandName, 'KeyCDN')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.keycdn.com/careers')
  assert.equal(provider.companyDomain, 'keycdn.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-jobs')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-no-public-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+no-public-openings-or-ats-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /keycdn[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.keycdn\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote first company/i)
  assert.match(provider.verifiedSurfaceSummary, /Made in Switzerland/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, keycdnModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'keycdn'), false)

  assert.equal(keycdn.PROVIDER_METADATA.source, KEYCDN_CATALOG.source)
  assert.equal(keycdn.PROVIDER_METADATA.companyName, KEYCDN_CATALOG.companyName)
})

test('KeyCDN backlog row matches directly from the local catalog without alias changes', async () => {
  const { KEYCDN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KeyCDN\n',
    catalog: [hydrateProviderCatalogEntry(KEYCDN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KeyCDN', 'keycdn', 'KeyCDN']],
  )
})

test('getScraperCatalog includes KeyCDN as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'keycdn')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'KeyCDN')
  assert.equal(provider.companyCareerPage, 'https://www.keycdn.com/careers')
  assert.equal(provider.companyDomain, 'keycdn.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-jobs')
  assert.match(provider.modulePath, /keycdn[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable KeyCDN scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'keycdn')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'keycdn')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-jobs')
  assert.match(scraper.dryRunFile, /keycdn[\\/]jobs\.json$/i)
})
