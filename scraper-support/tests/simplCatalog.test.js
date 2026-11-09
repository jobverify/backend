import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/simpl/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/simpl/catalog.js')
  } catch {
    assert.fail('Expected Simpl catalog module at ../../scraper/simpl/catalog.js')
  }
}

test('Simpl local catalog captures the verified first-party no-public-jobs surface', async () => {
  const {
    SIMPL_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, SIMPL_CATALOG)
  assert.equal(SIMPL_CATALOG.source, 'simpl')
  assert.equal(SIMPL_CATALOG.companyName, 'Simpl')
  assert.equal(SIMPL_CATALOG.officialBrandName, 'Simpl')
  assert.equal(SIMPL_CATALOG.adapter, 'script')
  assert.equal(SIMPL_CATALOG.modulePath, modulePath)
  assert.equal(SIMPL_CATALOG.dryRunFile, 'simpl/jobs.json')
  assert.equal(SIMPL_CATALOG.homepageUrl, 'https://www.get-simpl.com/index.html')
  assert.equal(SIMPL_CATALOG.aboutPageUrl, 'https://www.get-simpl.com/about.html')
  assert.equal(SIMPL_CATALOG.careersReferencePageUrl, 'https://sandbox.getsimpl.com/about-us/')
  assert.equal(SIMPL_CATALOG.companyDomain, 'get-simpl.com')
  assert.equal(SIMPL_CATALOG.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.equal(SIMPL_CATALOG.countryFilter, 'India')
  assert.equal(
    SIMPL_CATALOG.paginationStrategy,
    'homepage-plus-about-page-no-public-job-listings',
  )
  assert.equal(
    SIMPL_CATALOG.extractionStrategy,
    'verified-homepage+verified-about-page+return-empty-when-no-public-openings',
  )
  assert.equal(SIMPL_CATALOG.parser, 'custom-script')
  assert.equal(SIMPL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(SIMPL_CATALOG.verifiedOn, '2026-07-26')
  assert.equal(SIMPL_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Sunday, July 26, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.get-simpl\.com\/index\.html/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.get-simpl\.com\/about\.html/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/sandbox\.getsimpl\.com\/about-us\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no longer resolves upstream/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})

test('Simpl backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SIMPL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Simpl\n',
    catalog: [{ ...SIMPL_CATALOG, modulePath }],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Simpl', 'simpl', 'Simpl']],
  )
})
