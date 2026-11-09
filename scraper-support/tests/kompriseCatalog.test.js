import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const kompriseModulePath = path.resolve(currentDir, '../../scraper/komprise/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/komprise/catalog.js')
  } catch {
    assert.fail('Expected Komprise catalog module at ../../scraper/komprise/catalog.js')
  }
}

const loadKompriseModule = async () => {
  try {
    return await import('../../scraper/komprise/script.js')
  } catch {
    assert.fail('Expected Komprise scraper module at ../../scraper/komprise/script.js')
  }
}

test('Komprise local catalog captures the verified careers page, job sitemap, and India-role filter contract', async () => {
  const { KOMPRISE_CATALOG, VERIFIED_JOB_DETAIL_URLS } = await loadCatalogModule()
  const komprise = await loadKompriseModule()
  const provider = hydrateProviderCatalogEntry(KOMPRISE_CATALOG)

  assert.equal(provider.source, 'komprise')
  assert.equal(provider.companyName, 'Komprise')
  assert.equal(provider.officialBrandName, 'Komprise')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.komprise.com/')
  assert.equal(provider.companyCareerPage, 'https://www.komprise.com/careers/')
  assert.equal(provider.sitemapIndexUrl, 'https://www.komprise.com/sitemap_index.xml')
  assert.equal(provider.jobListingSitemapUrl, 'https://www.komprise.com/job_listing-sitemap.xml')
  assert.deepEqual(provider.verifiedJobDetailUrls, VERIFIED_JOB_DETAIL_URLS)
  assert.equal(provider.companyDomain, 'komprise.com')
  assert.equal(provider.atsPlatform, 'wp-job-manager')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-yoast-job-listing-sitemap',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+job-listing-sitemap+wp-job-manager-detail-pages+india-role-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.modulePath, kompriseModulePath)
  assert.match(provider.dryRunFile, /komprise[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.komprise\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.komprise\.com\/job_listing-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /\bindia_careers@komprise\.com\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bsoftware-development-engineer-test\b/i)

  assert.equal(komprise.PROVIDER_METADATA.source, KOMPRISE_CATALOG.source)
  assert.equal(komprise.PROVIDER_METADATA.companyName, KOMPRISE_CATALOG.companyName)
  assert.equal(
    komprise.PROVIDER_METADATA.jobListingSitemapUrl,
    KOMPRISE_CATALOG.jobListingSitemapUrl,
  )
})

test('Komprise exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { KOMPRISE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Komprise\n',
    catalog: [hydrateProviderCatalogEntry(KOMPRISE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Komprise', 'komprise', 'Komprise']],
  )
})
