import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sapphirefoods/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sapphirefoods/catalog.js')
  } catch {
    assert.fail('Expected Sapphire Foods catalog module at ../../scraper/sapphirefoods/catalog.js')
  }
}

test('Sapphire Foods local catalog captures the verified first-party empty-state contract for the official careers routes', async () => {
  const {
    SAPPHIRE_FOODS_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, SAPPHIRE_FOODS_CATALOG)
  assert.equal(SAPPHIRE_FOODS_CATALOG.source, 'sapphirefoods')
  assert.equal(SAPPHIRE_FOODS_CATALOG.companyName, 'Sapphire Foods')
  assert.equal(SAPPHIRE_FOODS_CATALOG.officialBrandName, 'Sapphire Foods India Ltd.')
  assert.equal(SAPPHIRE_FOODS_CATALOG.adapter, 'script')
  assert.equal(SAPPHIRE_FOODS_CATALOG.modulePath, modulePath)
  assert.equal(SAPPHIRE_FOODS_CATALOG.dryRunFile, 'sapphirefoods/jobs.json')
  assert.equal(SAPPHIRE_FOODS_CATALOG.officialHomepageUrl, 'https://www.sapphirefoods.in/')
  assert.equal(SAPPHIRE_FOODS_CATALOG.companyCareerPage, 'https://www.sapphire.terbiumsolutions.com/careers')
  assert.equal(
    SAPPHIRE_FOODS_CATALOG.storeCareersPageUrl,
    'https://www.sapphire.terbiumsolutions.com/careers/store-careers',
  )
  assert.equal(
    SAPPHIRE_FOODS_CATALOG.corporateCareersPageUrl,
    'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers',
  )
  assert.equal(SAPPHIRE_FOODS_CATALOG.resolvedCareersHost, 'www.sapphire.terbiumsolutions.com')
  assert.equal(SAPPHIRE_FOODS_CATALOG.companyDomain, 'sapphirefoods.in')
  assert.equal(SAPPHIRE_FOODS_CATALOG.atsPlatform, 'official-company-site-public-role-pages')
  assert.equal(SAPPHIRE_FOODS_CATALOG.countryFilter, 'India')
  assert.equal(
    SAPPHIRE_FOODS_CATALOG.paginationStrategy,
    'verified-branded-404-empty-state-or-store-and-corporate-pages-no-pagination',
  )
  assert.equal(
    SAPPHIRE_FOODS_CATALOG.extractionStrategy,
    'verified-branded-404-empty-state-or-verified-careers-landing+verified-store-careers-page+verified-corporate-careers-page+role-card-link-extraction',
  )
  assert.equal(SAPPHIRE_FOODS_CATALOG.parser, 'custom-script')
  assert.equal(SAPPHIRE_FOODS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(SAPPHIRE_FOODS_CATALOG.verifiedSampleStoreRoleTitle, 'Assistant Restaurant Manager')
  assert.equal(
    SAPPHIRE_FOODS_CATALOG.verifiedSampleCorporateRoleTitle,
    'Manager - Treasury ( Finance & Accounts)',
  )
  assert.equal(SAPPHIRE_FOODS_CATALOG.verifiedOn, '2026-08-04')
  assert.equal(SAPPHIRE_FOODS_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Tuesday, August 4, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.sapphire\.terbiumsolutions\.com\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /landing, store, and corporate careers pages/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Page not found/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /returns no jobs/i)
})

test('Sapphire Foods backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SAPPHIRE_FOODS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sapphire Foods\n',
    catalog: [{ ...SAPPHIRE_FOODS_CATALOG, modulePath }],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sapphire Foods', 'sapphirefoods', 'Sapphire Foods']],
  )
})
