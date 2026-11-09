import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sankalpsemiconductor/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sankalpsemiconductor/catalog.js')
  } catch {
    assert.fail('Expected Sankalp Semiconductor catalog module at ../../scraper/sankalpsemiconductor/catalog.js')
  }
}

test('Sankalp Semiconductor local catalog captures the exact-name first-party site and broken ATS handoff contract', async () => {
  const {
    SANKALP_SEMICONDUCTOR_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, SANKALP_SEMICONDUCTOR_CATALOG)
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.source, 'sankalpsemiconductor')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.companyName, 'Sankalp Semiconductor')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.officialBrandName, 'Sankalp Semiconductor')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.adapter, 'script')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.modulePath, modulePath)
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.dryRunFile, 'sankalpsemiconductor/jobs.json')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.officialHomepageUrl, 'https://sankalpsemi.hcltech.com/')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.contactPageUrl, 'https://sankalpsemi.hcltech.com/contact/')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.companyCareerPage, 'https://sankalpsemi.hcltech.com/')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.searchOpeningsHostUrl, 'https://sankalpsemi.alchemus.com/')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.jobOpportunitiesEmail, 'sankalp-recruit@hcl.com')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.companyDomain, 'sankalpsemi.hcltech.com')
  assert.equal(
    SANKALP_SEMICONDUCTOR_CATALOG.atsPlatform,
    'official-company-site-broken-ats-handoff-no-public-jobs',
  )
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.countryFilter, 'India')
  assert.equal(
    SANKALP_SEMICONDUCTOR_CATALOG.paginationStrategy,
    'official-homepage-careers-menu-plus-contact-page-plus-ats-reachability-probe',
  )
  assert.equal(
    SANKALP_SEMICONDUCTOR_CATALOG.extractionStrategy,
    'verified-homepage-search-openings-handoff+verified-contact-job-opportunities-email+unresolved-ats-host-return-empty',
  )
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.parser, 'custom-script')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(SANKALP_SEMICONDUCTOR_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Friday, July 17, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/sankalpsemi\.hcltech\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/sankalpsemi\.hcltech\.com\/contact\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/sankalpsemi\.alchemus\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Search Openings/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})

test('Sankalp Semiconductor backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SANKALP_SEMICONDUCTOR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sankalp Semiconductor\n',
    catalog: [{ ...SANKALP_SEMICONDUCTOR_CATALOG, modulePath }],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sankalp Semiconductor', 'sankalpsemiconductor', 'Sankalp Semiconductor']],
  )
})
