import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadIonicTradingCatalog = async () => {
  try {
    return await import('../../scraper/ionictrading/catalog.js')
  } catch {
    assert.fail('Expected Ionic Trading catalog module at ../../scraper/ionictrading/catalog.js')
  }
}

test('Ionic Trading catalog metadata captures the verified homepage-only no-jobs surface', async () => {
  const { IONIC_TRADING_CATALOG } = await loadIonicTradingCatalog()
  const provider = hydrateProviderCatalogEntry(IONIC_TRADING_CATALOG)

  assert.equal(provider.source, 'ionictrading')
  assert.equal(provider.companyName, 'Ionic Trading')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ionic.trade/')
  assert.equal(provider.homepageUrl, 'https://ionic.trade/')
  assert.equal(provider.documentationUrl, 'https://dev.api.ionic.trade/docs')
  assert.equal(provider.officialBrandName, 'Ionic')
  assert.equal(provider.productTagline, 'Solana Trading Infrastructure')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-adjacent-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-without-linked-public-careers+adjacent-routes-non-jobs-or-all-routes-unreachable-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ionic.trade')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.deepEqual(provider.adjacentRouteUrls, [
    'https://ionic.trade/about',
    'https://ionic.trade/careers',
    'https://ionic.trade/jobs',
    'https://ionic.trade/contact',
  ])
  assert.match(provider.modulePath, /ionictrading[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ionictrading[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ionic\.trade\//i)
  assert.match(provider.verifiedSurfaceSummary, /documentation navigation/i)
  assert.match(provider.verifiedSurfaceSummary, /Ionic marketing surface/i)
  assert.match(provider.verifiedSurfaceSummary, /authoritative empty result/i)
  assert.match(provider.verifiedSurfaceSummary, /unreachable/i)
})

test('Ionic Trading exact-name backlog rows resolve from local provider metadata without shared registry edits', async () => {
  const { IONIC_TRADING_CATALOG } = await loadIonicTradingCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Ionic Trading\n',
    catalog: [hydrateProviderCatalogEntry(IONIC_TRADING_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ionic Trading', 'ionictrading', 'Ionic Trading']],
  )
})
