import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKarnivalCatalog = async () => {
  try {
    return await import('../../scraper/karnival/catalog.js')
  } catch {
    assert.fail('Expected Karnival catalog module at ../../scraper/karnival/catalog.js')
  }
}

test('Karnival catalog captures the verified no-careers-route sitemap contract and missing routes metadata', async () => {
  const {
    KARNIVAL_CATALOG,
    default: defaultCatalog,
  } = await loadKarnivalCatalog()

  assert.equal(defaultCatalog, KARNIVAL_CATALOG)
  assert.equal(KARNIVAL_CATALOG.source, 'karnival')
  assert.equal(KARNIVAL_CATALOG.companyName, 'Karnival')
  assert.equal(KARNIVAL_CATALOG.officialBrandName, 'Karnival')
  assert.equal(KARNIVAL_CATALOG.adapter, 'script')
  assert.equal(KARNIVAL_CATALOG.companyCareerPage, 'https://www.karnival.com/')
  assert.equal(KARNIVAL_CATALOG.homepageUrl, 'https://www.karnival.com/')
  assert.equal(KARNIVAL_CATALOG.sitemapUrl, 'https://karnival.com/sitemap.xml')
  assert.deepEqual(KARNIVAL_CATALOG.missingJobsRouteUrls, [
    'https://karnival.com/careers',
    'https://karnival.com/jobs',
  ])
  assert.equal(KARNIVAL_CATALOG.companyDomain, 'karnival.com')
  assert.equal(KARNIVAL_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KARNIVAL_CATALOG.countryFilter, 'India')
  assert.equal(
    KARNIVAL_CATALOG.paginationStrategy,
    'verified-homepage-plus-sitemap-without-careers-routes-plus-missing-route-validation',
  )
  assert.equal(
    KARNIVAL_CATALOG.extractionStrategy,
    'verified-homepage-navigation+verified-sitemap-without-careers-or-jobs-routes+verified-careers-and-jobs-404',
  )
  assert.equal(KARNIVAL_CATALOG.parser, 'custom-script')
  assert.equal(KARNIVAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KARNIVAL_CATALOG.dryRunFile, 'karnival/jobs.json')
  assert.equal(KARNIVAL_CATALOG.verifiedOn, '2026-08-15')
  assert.match(KARNIVAL_CATALOG.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(KARNIVAL_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.karnival\.com\//i)
  assert.match(KARNIVAL_CATALOG.verifiedSurfaceSummary, /https:\/\/karnival\.com\/sitemap\.xml/i)
  assert.match(KARNIVAL_CATALOG.verifiedSurfaceSummary, /https:\/\/karnival\.com\/careers/i)
  assert.match(KARNIVAL_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(KARNIVAL_CATALOG.modulePath, /karnival[\\/]script\.js$/i)
})

test('Karnival backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KARNIVAL_CATALOG } = await loadKarnivalCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Karnival\n',
    catalog: [KARNIVAL_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Karnival', 'karnival', 'Karnival']],
  )
})
