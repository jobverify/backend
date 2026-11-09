import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/khatabook/catalog.js')
  } catch {
    assert.fail('Expected Khatabook catalog module at ../../scraper/khatabook/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/khatabook/script.js')
  } catch {
    assert.fail('Expected Khatabook scraper module at ../../scraper/khatabook/script.js')
  }
}

test('Khatabook local catalog captures the verified first-party category API surface', async () => {
  const { KHATABOOK_CATALOG } = await loadCatalogModule()
  const khatabook = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KHATABOOK_CATALOG)

  assert.equal(KHATABOOK_CATALOG.source, 'khatabook')
  assert.equal(KHATABOOK_CATALOG.companyName, 'Khatabook')
  assert.equal(KHATABOOK_CATALOG.officialBrandName, 'Khatabook')
  assert.equal(KHATABOOK_CATALOG.adapter, 'script')
  assert.equal(KHATABOOK_CATALOG.modulePath, '../../scraper/khatabook/script.js')
  assert.equal(KHATABOOK_CATALOG.dryRunFile, 'khatabook/jobs.json')
  assert.equal(KHATABOOK_CATALOG.homepageUrl, 'https://khatabook.com/')
  assert.equal(KHATABOOK_CATALOG.companyCareerPage, 'https://khatabook.com/en/hiring/')
  assert.equal(KHATABOOK_CATALOG.careersScriptUrl, 'https://khatabook-assets.s3.amazonaws.com/static/js/hiring.js')
  assert.equal(KHATABOOK_CATALOG.categoryJobsApiBaseUrl, 'https://khatabook.com/hiring/recruiter/list')
  assert.equal(KHATABOOK_CATALOG.publicApplyHost, 'https://khatabook.turbohire.co')
  assert.equal(KHATABOOK_CATALOG.atsPlatform, 'official-careers-page-plus-turbohire-publicjobs')
  assert.equal(KHATABOOK_CATALOG.countryFilter, 'India')
  assert.equal(KHATABOOK_CATALOG.paginationStrategy, 'official-careers-page-category-enumeration')
  assert.equal(
    KHATABOOK_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-hiring-js+same-origin-category-jobs-endpoint+turbohire-apply-links',
  )
  assert.equal(KHATABOOK_CATALOG.parser, 'custom-script')
  assert.equal(KHATABOOK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KHATABOOK_CATALOG.companyDomain, 'khatabook.com')
  assert.equal(KHATABOOK_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(KHATABOOK_CATALOG.verifiedPublicPostingCount, 12)
  assert.match(KHATABOOK_CATALOG.verifiedSurfaceSummary, /https:\/\/khatabook\.com\/en\/hiring\//i)
  assert.match(KHATABOOK_CATALOG.verifiedSurfaceSummary, /https:\/\/khatabook\.com\/hiring\/recruiter\/list/i)
  assert.match(KHATABOOK_CATALOG.verifiedSurfaceSummary, /https:\/\/khatabook\.turbohire\.co\/job\/publicjobs\//i)
  assert.match(KHATABOOK_CATALOG.verifiedSurfaceSummary, /12 unique public jobs/i)

  assert.equal(provider.source, 'khatabook')
  assert.equal(provider.companyName, 'Khatabook')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://khatabook.com/en/hiring/')
  assert.equal(provider.companyDomain, 'khatabook.com')
  assert.match(provider.modulePath, /khatabook[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /khatabook[\\/]jobs\.json$/i)

  assert.equal(khatabook.PROVIDER_METADATA.source, provider.source)
  assert.equal(khatabook.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(khatabook.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(khatabook.CAREERS_SCRIPT_URL, provider.careersScriptUrl)
  assert.equal(khatabook.CATEGORY_JOBS_API_BASE_URL, provider.categoryJobsApiBaseUrl)
})

test('Khatabook exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { KHATABOOK_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Khatabook\n',
    catalog: [hydrateProviderCatalogEntry(KHATABOOK_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Khatabook', 'khatabook', 'Khatabook']],
  )
})
