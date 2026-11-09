import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const railwayModulePath = path.resolve(currentDir, '../../scraper/railway/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/railway/catalog.js')
  } catch {
    assert.fail('Expected Railway catalog module at ../../scraper/railway/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/railway/script.js')
  } catch {
    assert.fail('Expected Railway scraper module at ../../scraper/railway/script.js')
  }
}

test('Railway local catalog captures the verified first-party careers page and global-remote openings contract', async () => {
  const { RAILWAY_CATALOG } = await loadCatalogModule()
  const railway = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(RAILWAY_CATALOG)

  assert.equal(provider.source, 'railway')
  assert.equal(provider.companyName, 'Railway')
  assert.equal(provider.officialBrandName, 'Railway')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://railway.com/careers')
  assert.equal(provider.companyDomain, 'railway.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-current-global-remote-slice')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+same-domain-role-links+return-empty-when-no-india-locations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 16)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.dryRunFile, /railway[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/railway\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Redefine the future of infrastructure/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Infra Engineer: Platform/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Infra Engineer: Observability/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote \(anywhere\)/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India locations/i)
  assert.equal(provider.modulePath, railwayModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Railway'), false)

  assert.equal(railway.PROVIDER_METADATA.source, RAILWAY_CATALOG.source)
  assert.equal(railway.PROVIDER_METADATA.companyName, RAILWAY_CATALOG.companyName)
})

test('Railway backlog row matches directly from the local catalog without alias changes', async () => {
  const { RAILWAY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Railway\n',
    catalog: [hydrateProviderCatalogEntry(RAILWAY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Railway', 'railway', 'Railway']],
  )
})

test('getScraperCatalog includes Railway as a verified exact-name script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'railway')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Railway')
  assert.equal(provider.companyCareerPage, 'https://railway.com/careers')
  assert.equal(provider.companyDomain, 'railway.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.match(provider.modulePath, /railway[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Railway scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'railway')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'railway')
  assert.equal(scraper.provider.atsPlatform, 'official-first-party-careers-page')
  assert.match(scraper.dryRunFile, /railway[\\/]jobs\.json$/i)
})
