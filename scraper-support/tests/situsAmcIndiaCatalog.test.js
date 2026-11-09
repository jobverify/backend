import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/situsamcindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/situsamcindia/catalog.js')
  } catch {
    assert.fail('Expected SitusAMC India catalog module at ../../scraper/situsamcindia/catalog.js')
  }
}

test('SitusAMC India local catalog captures the verified official careers surfaces with India public jobs', async () => {
  const {
    SITUS_AMC_INDIA_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, SITUS_AMC_INDIA_CATALOG)
  assert.equal(SITUS_AMC_INDIA_CATALOG.source, 'situsamcindia')
  assert.equal(SITUS_AMC_INDIA_CATALOG.companyName, 'SitusAMC India')
  assert.equal(SITUS_AMC_INDIA_CATALOG.officialBrandName, 'SitusAMC')
  assert.equal(SITUS_AMC_INDIA_CATALOG.adapter, 'script')
  assert.equal(SITUS_AMC_INDIA_CATALOG.modulePath, modulePath)
  assert.equal(SITUS_AMC_INDIA_CATALOG.dryRunFile, 'situsamcindia/jobs.json')
  assert.equal(SITUS_AMC_INDIA_CATALOG.homepageUrl, 'https://careers.situsamc.com/')
  assert.equal(SITUS_AMC_INDIA_CATALOG.companyCareerPage, 'https://careers.situsamc.com/job-search')
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.corporateJobsPageUrl,
    'https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities',
  )
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.residentialJobsPageUrl,
    'https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities',
  )
  assert.equal(SITUS_AMC_INDIA_CATALOG.companyDomain, 'careers.situsamc.com')
  assert.equal(SITUS_AMC_INDIA_CATALOG.atsPlatform, 'official-company-site-public-job-pages')
  assert.equal(SITUS_AMC_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.paginationStrategy,
    'official-india-job-search-plus-corporate-and-residential-current-job-pages-no-api',
  )
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.extractionStrategy,
    'verified-job-search+verified-corporate-jobs-page+verified-residential-jobs-page+india-role-card-links+detail-page-parsing',
  )
  assert.equal(SITUS_AMC_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(SITUS_AMC_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.verifiedSampleCorporateRoleTitle,
    'Assistant Manager, Human Resources Business Partner',
  )
  assert.equal(
    SITUS_AMC_INDIA_CATALOG.verifiedSampleResidentialRoleTitle,
    'Senior Underwriter, Shared Services',
  )
  assert.equal(SITUS_AMC_INDIA_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(SITUS_AMC_INDIA_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Friday, July 17, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.situsamc\.com\/job-search/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /corporate-careers\/job-opportunities/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /residential-real-estate-careers\/job-opportunities/i)
})

test('SitusAMC India backlog row matches directly from local provider metadata without alias churn', async () => {
  const { SITUS_AMC_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SitusAMC India\n',
    catalog: [{ ...SITUS_AMC_INDIA_CATALOG, modulePath }],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SitusAMC India', 'situsamcindia', 'SitusAMC India']],
  )
})
