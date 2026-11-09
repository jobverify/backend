import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const auzmorModulePath = path.resolve(currentDir, '../../scraper/auzmor/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/auzmor/catalog.js')
  } catch {
    assert.fail('Expected Auzmor catalog module at ../../scraper/auzmor/catalog.js')
  }
}

const loadAuzmorModule = async () => {
  try {
    return await import('../../scraper/auzmor/script.js')
  } catch {
    assert.fail('Expected Auzmor scraper module at ../../scraper/auzmor/script.js')
  }
}

test('Auzmor local catalog binds the current corporate Auzmor Hire widget and native inventory contract', async () => {
  const { AUZMOR_CATALOG } = await loadCatalogModule()
  const auzmor = await loadAuzmorModule()

  assert.equal(AUZMOR_CATALOG.source, 'auzmor')
  assert.equal(AUZMOR_CATALOG.companyName, 'Auzmor')
  assert.equal(AUZMOR_CATALOG.officialBrandName, 'Auzmor')
  assert.equal(AUZMOR_CATALOG.adapter, 'script')
  assert.equal(AUZMOR_CATALOG.companyCareerPage, 'https://auzmor.com/careers/')
  assert.equal(AUZMOR_CATALOG.homepageUrl, 'https://auzmor.com/')
  assert.equal(AUZMOR_CATALOG.careersPageUrl, 'https://auzmor.com/careers/')
  assert.equal(AUZMOR_CATALOG.pageSitemapUrl, 'https://auzmor.com/page-sitemap.xml')
  assert.deepEqual(AUZMOR_CATALOG.sitemapCareerRouteUrls, ['https://auzmor.com/careers/'])
  assert.deepEqual(AUZMOR_CATALOG.careerAliasRouteUrls, ['https://auzmor.com/career'])
  assert.deepEqual(AUZMOR_CATALOG.noPublicJobRouteUrls, [
    'https://auzmor.com/jobs',
    'https://auzmor.com/join-us',
    'https://auzmor.com/work-with-us',
    'https://auzmor.com/openings',
    'https://auzmor.com/current-openings',
    'https://auzmor.com/company/careers',
    'https://auzmor.com/about/careers',
  ])
  assert.equal(AUZMOR_CATALOG.atsPlatform, 'auzmor-hire')
  assert.equal(AUZMOR_CATALOG.countryFilter, 'India')
  assert.equal(
    AUZMOR_CATALOG.paginationStrategy,
    'native-grouped-pagination-filter-counts-and-closing-inventory',
  )
  assert.equal(
    AUZMOR_CATALOG.extractionStrategy,
    'corporate-published-auzmor-hire-widget+native-employer+grouped-pagination-and-filter-counts+India-full-details+closing-inventory',
  )
  assert.equal(AUZMOR_CATALOG.parser, 'custom-script')
  assert.equal(AUZMOR_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AUZMOR_CATALOG.companyDomain, 'auzmor.com')
  assert.equal(AUZMOR_CATALOG.verifiedOn, '2026-11-02')
  assert.match(AUZMOR_CATALOG.verifiedSurfaceSummary, /https:\/\/auzmor\.com\//i)
  assert.match(AUZMOR_CATALOG.verifiedSurfaceSummary, /https:\/\/auzmor\.com\/careers\//i)
  assert.match(AUZMOR_CATALOG.verifiedSurfaceSummary, /hire\.api\.auzmor\.com\/api\/v1/i)
  assert.match(AUZMOR_CATALOG.verifiedSurfaceSummary, /native.*location/i)
  assert.equal(AUZMOR_CATALOG.modulePath, auzmorModulePath)

  assert.equal(auzmor.PROVIDER_METADATA.source, AUZMOR_CATALOG.source)
  assert.equal(auzmor.PROVIDER_METADATA.companyName, AUZMOR_CATALOG.companyName)
  assert.equal(auzmor.PROVIDER_METADATA.companyCareerPage, AUZMOR_CATALOG.companyCareerPage)
  assert.equal(auzmor.PROVIDER_METADATA.pageSitemapUrl, AUZMOR_CATALOG.pageSitemapUrl)
})

test('Auzmor coverage resolves the backlog company name without requiring an alias entry', async () => {
  const { AUZMOR_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Auzmor\n',
    catalog: [AUZMOR_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Auzmor', 'auzmor', 'Auzmor']],
  )
})

test('buildScrapers and company coverage resolve Auzmor from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'auzmor')
  const scraper = buildScrapers().find((item) => item.name === 'auzmor')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Auzmor')
  assert.equal(provider.companyCareerPage, 'https://auzmor.com/careers/')
  assert.match(scraper.dryRunFile, /auzmor[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Auzmor\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Auzmor', 'auzmor', 'Auzmor']],
  )
})
