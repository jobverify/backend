import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAjnaLensCatalog = async () => {
  try {
    return await import('../../scraper/ajnalens/catalog.js')
  } catch {
    assert.fail('Expected AjnaLens catalog module at ../../scraper/ajnalens/catalog.js')
  }
}

test('AjnaLens provider metadata captures the verified first-party careers page without aliases', async () => {
  const { AJNALENS_CATALOG } = await loadAjnaLensCatalog()
  const provider = hydrateProviderCatalogEntry(AJNALENS_CATALOG)

  assert.equal(provider.source, 'ajnalens')
  assert.equal(provider.companyName, 'AjnaLens')
  assert.equal(provider.officialBrandName, 'AjnaLens')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ajnalens.com/careers')
  assert.equal(provider.homepageUrl, 'https://ajnalens.com/')
  assert.equal(provider.applicationUrl, 'https://ajnalens.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-nextjs-careers-page+embedded-openings-payload+shared-first-party-careers-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ajnalens.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /ajnalens[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ajnalens\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Researcher/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Start Your Journey With Us/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AjnaLens'), false)
})

test('AjnaLens backlog row matches directly from provider metadata without alias churn', async () => {
  const { AJNALENS_CATALOG } = await loadAjnaLensCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'AjnaLens\n',
    catalog: [hydrateProviderCatalogEntry(AJNALENS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AjnaLens', 'ajnalens', 'AjnaLens']],
  )
})

test('buildScrapers and company coverage resolve AjnaLens from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ajnalens')
  const scraper = buildScrapers().find((item) => item.name === 'ajnalens')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AjnaLens')
  assert.equal(provider.companyCareerPage, 'https://ajnalens.com/careers')
  assert.match(scraper.dryRunFile, /ajnalens[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AjnaLens\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AjnaLens', 'ajnalens', 'AjnaLens']],
  )
})
