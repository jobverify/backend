import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAktekCatalog = async () => {
  try {
    return await import('../../scraper/aktek/catalog.js')
  } catch {
    assert.fail('Expected Aktek catalog module at ../../scraper/aktek/catalog.js')
  }
}

test('Aktek provider metadata records declared corporate crawl discovery without a complete inventory claim', async () => {
  const { AKTEK_CATALOG } = await loadAktekCatalog()
  const provider = hydrateProviderCatalogEntry(AKTEK_CATALOG)

  assert.equal(provider.source, 'aktek')
  assert.equal(provider.companyName, 'Aktek')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://aktek.io/')
  assert.equal(provider.companyDomain, 'aktek.io')
  assert.equal(provider.robotsTxtUrl, 'https://aktek.io/robots.txt')
  assert.equal(provider.sitemapIndexUrl, 'https://aktek.io/sitemap_index.xml')
  assert.equal(provider.pageSitemapUrl, 'https://aktek.io/page-sitemap.xml')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-homepage-and-declared-crawl-discovery')
  assert.equal(
    provider.extractionStrategy,
    'qualified-corporate-crawl-documents-return-explicit-incomplete-inventory-evidence',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.match(provider.modulePath, /aktek[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /November 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aktek\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aktek\.io\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aktek\.io\/page-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aktek'), false)
})

test('Aktek backlog row matches directly from provider metadata without alias churn', async () => {
  const { AKTEK_CATALOG } = await loadAktekCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aktek\n',
    catalog: [hydrateProviderCatalogEntry(AKTEK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aktek', 'aktek', 'Aktek']],
  )
})

test('buildScrapers and company coverage resolve Aktek from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aktek')
  const scraper = buildScrapers().find((item) => item.name === 'aktek')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aktek')
  assert.equal(provider.companyCareerPage, 'https://aktek.io/')
  assert.match(scraper.dryRunFile, /aktek[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aktek\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aktek', 'aktek', 'Aktek']],
  )
})
