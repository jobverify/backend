import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shipyaari/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shipyaari/catalog.js')
  } catch {
    assert.fail('Expected Shipyaari catalog module at ../../scraper/shipyaari/catalog.js')
  }
}

test('Shipyaari local catalog captures the verified first-party careers surface and role detail pages', async () => {
  const {
    SHIPYAARI_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, SHIPYAARI_CATALOG)
  assert.equal(SHIPYAARI_CATALOG.source, 'shipyaari')
  assert.equal(SHIPYAARI_CATALOG.companyName, 'Shipyaari')
  assert.equal(SHIPYAARI_CATALOG.officialBrandName, 'Shipyaari')
  assert.equal(SHIPYAARI_CATALOG.adapter, 'script')
  assert.equal(SHIPYAARI_CATALOG.modulePath, modulePath)
  assert.equal(SHIPYAARI_CATALOG.dryRunFile, 'shipyaari/jobs.json')
  assert.equal(SHIPYAARI_CATALOG.homepageUrl, 'https://www.shipyaari.com/')
  assert.equal(SHIPYAARI_CATALOG.companyCareerPage, 'https://www.shipyaari.com/careers/')
  assert.equal(SHIPYAARI_CATALOG.companyDomain, 'shipyaari.com')
  assert.equal(SHIPYAARI_CATALOG.atsPlatform, 'official-company-site-public-role-pages')
  assert.equal(SHIPYAARI_CATALOG.countryFilter, 'India')
  assert.equal(SHIPYAARI_CATALOG.paginationStrategy, 'single-official-careers-page-no-pagination')
  assert.equal(
    SHIPYAARI_CATALOG.extractionStrategy,
    'verified-official-careers-page+first-party-role-card-links+first-party-role-detail-page-parsing',
  )
  assert.equal(SHIPYAARI_CATALOG.parser, 'custom-script')
  assert.equal(SHIPYAARI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(SHIPYAARI_CATALOG.verifiedSampleRoleTitle, 'Sales Head - B2C & D2C')
  assert.equal(
    SHIPYAARI_CATALOG.verifiedSampleRoleDetailUrl,
    'https://www.shipyaari.com/careers/sales-manager/',
  )
  assert.equal(SHIPYAARI_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(SHIPYAARI_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Friday, July 17, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.shipyaari\.com\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /sales-manager/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Customer Growth Manager/i)
})

test('Shipyaari backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SHIPYAARI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shipyaari\n',
    catalog: [{ ...SHIPYAARI_CATALOG, modulePath }],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shipyaari', 'shipyaari', 'Shipyaari']],
  )
})
