import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAkshayakalpaCatalog = async () => {
  try {
    return await import('../../scraper/akshayakalpa/catalog.js')
  } catch {
    assert.fail('Expected Akshayakalpa catalog module at ../../scraper/akshayakalpa/catalog.js')
  }
}

test('Akshayakalpa provider metadata captures the verified first-party no-public-careers surface without aliases', async () => {
  const { AKSHAYAKALPA_CATALOG } = await loadAkshayakalpaCatalog()
  const provider = hydrateProviderCatalogEntry(AKSHAYAKALPA_CATALOG)

  assert.equal(provider.source, 'akshayakalpa')
  assert.equal(provider.companyName, 'Akshayakalpa')
  assert.equal(provider.officialBrandName, 'Akshayakalpa Organic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://akshayakalpa.org/')
  assert.equal(provider.companyDomain, 'akshayakalpa.org')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-crawl-surface-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-crawl-surfaces-without-careers+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /akshayakalpa[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/akshayakalpa\.org\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/akshayakalpa\.org\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/akshayakalpa\.org\/page-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Akshayakalpa'), false)
})

test('Akshayakalpa backlog row matches directly from provider metadata without alias churn', async () => {
  const { AKSHAYAKALPA_CATALOG } = await loadAkshayakalpaCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Akshayakalpa\n',
    catalog: [hydrateProviderCatalogEntry(AKSHAYAKALPA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akshayakalpa', 'akshayakalpa', 'Akshayakalpa']],
  )
})

test('buildScrapers and company coverage resolve Akshayakalpa from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akshayakalpa')
  const scraper = buildScrapers().find((item) => item.name === 'akshayakalpa')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akshayakalpa')
  assert.equal(provider.companyCareerPage, 'https://akshayakalpa.org/')
  assert.match(scraper.dryRunFile, /akshayakalpa[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akshayakalpa\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akshayakalpa', 'akshayakalpa', 'Akshayakalpa']],
  )
})
