import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAlphavectorCatalog = async () => {
  try {
    return await import('../../scraper/alphavector/catalog.js')
  } catch {
    assert.fail('Expected Alphavector catalog module at ../../scraper/alphavector/catalog.js')
  }
}

test('Alphavector provider metadata captures the verified parked no-public-careers surface without aliases', async () => {
  const { ALPHAVECTOR_CATALOG } = await loadAlphavectorCatalog()
  const provider = hydrateProviderCatalogEntry(ALPHAVECTOR_CATALOG)

  assert.equal(provider.source, 'alphavector')
  assert.equal(provider.companyName, 'Alphavector')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://alphavector.co/')
  assert.equal(provider.companyDomain, 'alphavector.co')
  assert.equal(provider.robotsTxtUrl, 'https://alphavector.co/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://alphavector.co/sitemap.xml')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-parked-homepage-plus-sitemap-plus-common-careers-route-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-parked-homepage+verified-robots-and-sitemap-with-single-lander-url+verified-common-careers-routes-share-parked-redirect-or-all-routes-unreachable-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.modulePath, /alphavector[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/alphavector\.co\//i)
  assert.match(provider.verifiedSurfaceSummary, /robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /sitemap/i)
  assert.match(provider.verifiedSurfaceSummary, /parked redirect shell/i)
  assert.match(provider.verifiedSurfaceSummary, /no alternate official jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Alphavector'), false)
})

test('Alphavector backlog row matches directly from provider metadata without alias churn', async () => {
  const { ALPHAVECTOR_CATALOG } = await loadAlphavectorCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Alphavector\n',
    catalog: [hydrateProviderCatalogEntry(ALPHAVECTOR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alphavector', 'alphavector', 'Alphavector']],
  )
})

test('buildScrapers and company coverage resolve Alphavector from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphavector')
  const scraper = buildScrapers().find((item) => item.name === 'alphavector')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Alphavector')
  assert.equal(provider.companyCareerPage, 'https://alphavector.co/')
  assert.match(scraper.dryRunFile, /alphavector[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Alphavector\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alphavector', 'alphavector', 'Alphavector']],
  )
})
