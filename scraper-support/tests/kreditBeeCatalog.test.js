import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kreditbee/catalog.js')
  } catch {
    assert.fail('Expected KreditBee catalog module at ../../scraper/kreditbee/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/kreditbee/script.js')
  } catch {
    assert.fail('Expected KreditBee scraper module at ../../scraper/kreditbee/script.js')
  }
}

test('KreditBee local catalog documents the verified fail-closed first-party careers shell state', async () => {
  const { KREDITBEE_CATALOG } = await loadCatalogModule()
  const kreditbee = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(KREDITBEE_CATALOG)

  assert.equal(provider.source, 'kreditbee')
  assert.equal(provider.companyName, 'KreditBee')
  assert.equal(provider.officialBrandName, 'KreditBee')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kreditbee.in/careers')
  assert.equal(provider.homepageUrl, 'https://www.kreditbee.in/')
  assert.equal(provider.sitemapUrl, 'https://www.kreditbee.in/sitemap.xml')
  assert.deepEqual(provider.verifiedDetailProbeUrls, [
    'https://www.kreditbee.in/careers/data-engineer',
    'https://www.kreditbee.in/careers/Team-Lead',
  ])
  assert.equal(provider.companyDomain, 'kreditbee.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-shell-plus-sitemap-and-detail-route-verification')
  assert.equal(
    provider.extractionStrategy,
    'verified-react-shell-careers-page+limited-sitemap-signal+non-verifiable-detail-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kreditbee\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kreditbee\.in\/careers\/data-engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kreditbee\.in\/careers\/Team-Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /returns an empty array/i)
  assert.match(provider.modulePath, /kreditbee[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kreditbee[\\/]jobs\.json$/i)

  assert.equal(kreditbee.PROVIDER_METADATA.source, provider.source)
  assert.equal(kreditbee.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(kreditbee.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(kreditbee.PROVIDER_METADATA.sitemapUrl, provider.sitemapUrl)
})

test('KreditBee exact backlog row matches from the local provider contract without aliases', async () => {
  const { KREDITBEE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KreditBee\n',
    catalog: [hydrateProviderCatalogEntry(KREDITBEE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KreditBee', 'kreditbee', 'KreditBee']],
  )
})
