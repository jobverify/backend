import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKarbonnCatalog = async () => {
  try {
    return await import('../../scraper/karbonn/catalog.js')
  } catch {
    assert.fail('Expected Karbonn catalog module at ../../scraper/karbonn/catalog.js')
  }
}

test('Karbonn catalog captures the verified official subscribe-only careers surface and stale route metadata', async () => {
  const {
    KARBONN_CATALOG,
    default: defaultCatalog,
  } = await loadKarbonnCatalog()

  assert.equal(defaultCatalog, KARBONN_CATALOG)
  assert.equal(KARBONN_CATALOG.source, 'karbonn')
  assert.equal(KARBONN_CATALOG.companyName, 'Karbonn')
  assert.equal(KARBONN_CATALOG.officialBrandName, 'karbonn')
  assert.equal(KARBONN_CATALOG.adapter, 'script')
  assert.equal(KARBONN_CATALOG.companyCareerPage, 'https://karbonn.in/?page_id=944')
  assert.equal(KARBONN_CATALOG.homepageUrl, 'https://www.karbonnmobiles.com/')
  assert.equal(KARBONN_CATALOG.companyDomain, 'karbonn.in')
  assert.equal(KARBONN_CATALOG.staleCareerRouteUrl, 'https://www.karbonnmobiles.com/careers.html?view=apply')
  assert.equal(KARBONN_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KARBONN_CATALOG.countryFilter, 'India')
  assert.equal(
    KARBONN_CATALOG.paginationStrategy,
    'verified-homepage-careers-link-plus-subscribe-only-careers-page-plus-stale-route-validation',
  )
  assert.equal(
    KARBONN_CATALOG.extractionStrategy,
    'verified-homepage-careers-link+verified-subscribe-only-careers-page+verified-stale-careers-route-404',
  )
  assert.equal(KARBONN_CATALOG.parser, 'custom-script')
  assert.equal(KARBONN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KARBONN_CATALOG.dryRunFile, 'karbonn/jobs.json')
  assert.equal(KARBONN_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KARBONN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.karbonnmobiles\.com\//i)
  assert.match(KARBONN_CATALOG.verifiedSurfaceSummary, /https:\/\/karbonn\.in\/\?page_id=944/i)
  assert.match(KARBONN_CATALOG.verifiedSurfaceSummary, /ENTER YOUR EMAIL/i)
  assert.match(KARBONN_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(KARBONN_CATALOG.modulePath, /karbonn[\\/]script\.js$/i)
})

test('Karbonn backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KARBONN_CATALOG } = await loadKarbonnCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Karbonn\n',
    catalog: [KARBONN_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Karbonn', 'karbonn', 'Karbonn']],
  )
})
