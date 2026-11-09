import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadLinkedInCatalog = async () => {
  try {
    return await import('../../scraper/linkedin/catalog.js')
  } catch {
    assert.fail('Expected LinkedIn catalog module at ../../scraper/linkedin/catalog.js')
  }
}

test('LinkedIn catalog captures the verified public company-filtered jobs search and detail pages', async () => {
  const {
    LINKEDIN_CATALOG,
    default: defaultCatalog,
  } = await loadLinkedInCatalog()

  assert.equal(defaultCatalog, LINKEDIN_CATALOG)
  assert.equal(LINKEDIN_CATALOG.source, 'linkedin')
  assert.equal(LINKEDIN_CATALOG.companyName, 'LinkedIn')
  assert.equal(LINKEDIN_CATALOG.officialBrandName, 'LinkedIn')
  assert.equal(LINKEDIN_CATALOG.adapter, 'script')
  assert.equal(
    LINKEDIN_CATALOG.companyCareerPage,
    'https://www.linkedin.com/jobs/search/?f_C=1337&geoId=102713980',
  )
  assert.equal(LINKEDIN_CATALOG.homepageUrl, 'https://www.linkedin.com/')
  assert.deepEqual(LINKEDIN_CATALOG.verifiedRoleUrls, [
    'https://in.linkedin.com/jobs/view/account-manager-linkedin-talent-solutions-at-linkedin-4422287519',
    'https://in.linkedin.com/jobs/view/senior-sales-manager-linkedin-marketing-solutions-at-linkedin-4419298054',
  ])
  assert.equal(LINKEDIN_CATALOG.companyDomain, 'linkedin.com')
  assert.equal(LINKEDIN_CATALOG.atsPlatform, 'linkedin-public-jobs-search')
  assert.equal(LINKEDIN_CATALOG.countryFilter, 'India')
  assert.equal(
    LINKEDIN_CATALOG.paginationStrategy,
    'single-public-company-filtered-jobs-search-plus-public-detail-pages',
  )
  assert.equal(
    LINKEDIN_CATALOG.extractionStrategy,
    'verified-linkedin-public-jobs-search+company-filtered-listing-cards+public-jobposting-jsonld-detail-pages',
  )
  assert.equal(LINKEDIN_CATALOG.parser, 'custom-script')
  assert.equal(LINKEDIN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LINKEDIN_CATALOG.dryRunFile, 'linkedin/jobs.json')
  assert.equal(LINKEDIN_CATALOG.verifiedOn, '2026-10-09')
  assert.match(LINKEDIN_CATALOG.verifiedSurfaceSummary, /f_C=1337&geoId=102713980/i)
  assert.match(LINKEDIN_CATALOG.verifiedSurfaceSummary, /47 unique company-filtered LinkedIn jobs in India/i)
  assert.match(LINKEDIN_CATALOG.verifiedSurfaceSummary, /All 47 public detail pages/i)
  assert.match(LINKEDIN_CATALOG.modulePath, /linkedin[\\/]script\.js$/i)
})

test('LinkedIn backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { LINKEDIN_CATALOG } = await loadLinkedInCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'LinkedIn\n',
    catalog: [LINKEDIN_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LinkedIn', 'linkedin', 'LinkedIn']],
  )
})
