import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const haptikModulePath = path.resolve(currentDir, '../../scraper/haptik/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/haptik/catalog.js')
  } catch {
    assert.fail('Expected Haptik catalog module at ../../scraper/haptik/catalog.js')
  }
}

const loadHaptikModule = async () => {
  try {
    return await import('../../scraper/haptik/script.js')
  } catch {
    assert.fail('Expected Haptik scraper module at ../../scraper/haptik/script.js')
  }
}

test('Haptik local catalog captures the verified first-party careers handoff and Freshteam India board without aliases', async () => {
  const { HAPTIK_CATALOG } = await loadCatalogModule()
  const haptik = await loadHaptikModule()
  const provider = hydrateProviderCatalogEntry(HAPTIK_CATALOG)

  assert.equal(provider.source, 'haptik')
  assert.equal(provider.companyName, 'Haptik')
  assert.equal(provider.officialBrandName, 'Haptik')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.haptik.ai/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.haptik.ai/careers')
  assert.equal(provider.officialJobsBoardUrl, 'https://haptik.freshteam.com/jobs')
  assert.equal(provider.detailUrlPattern, 'https://haptik.freshteam.com/jobs/{opaque_id}/{slug}')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-public-freshteam-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-handoff+public-freshteam-board+detail-page-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'haptik.ai')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /haptik[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.haptik\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/haptik\.freshteam\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer - Backend/i)
  assert.match(provider.verifiedSurfaceSummary, /Voice AI Engineer \(Hybrid\)/i)
  assert.equal(provider.modulePath, haptikModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Haptik'), false)

  assert.equal(haptik.PROVIDER_METADATA.source, HAPTIK_CATALOG.source)
  assert.equal(haptik.PROVIDER_METADATA.companyName, HAPTIK_CATALOG.companyName)
  assert.equal(haptik.PROVIDER_METADATA.officialJobsBoardUrl, HAPTIK_CATALOG.officialJobsBoardUrl)
})

test('Haptik backlog row matches directly from the local catalog without alias churn', async () => {
  const { HAPTIK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Haptik\n',
    catalog: [hydrateProviderCatalogEntry(HAPTIK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Haptik', 'haptik', 'Haptik']],
  )
})

test('getScraperCatalog includes Haptik as a verified Freshteam provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'haptik')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Haptik')
  assert.equal(provider.companyCareerPage, 'https://www.haptik.ai/careers')
  assert.equal(provider.companyDomain, 'haptik.ai')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.match(provider.modulePath, /haptik[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Haptik scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'haptik')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'haptik')
  assert.equal(scraper.provider.atsPlatform, 'freshteam')
  assert.match(scraper.dryRunFile, /haptik[\\/]jobs\.json$/i)
})
