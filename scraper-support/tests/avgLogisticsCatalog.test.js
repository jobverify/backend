import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const avgLogisticsModulePath = path.resolve(currentDir, '../../scraper/avglogistics/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/avglogistics/catalog.js')
  } catch {
    assert.fail('Expected AVG Logistics catalog module at ../../scraper/avglogistics/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/avglogistics/script.js')
  } catch {
    assert.fail('Expected AVG Logistics scraper module at ../../scraper/avglogistics/script.js')
  }
}

test('AVG Logistics local catalog retains the current configured panel and unknown native inventory', async () => {
  const { AVG_LOGISTICS_CATALOG } = await loadCatalogModule()
  const avgLogistics = await loadScriptModule()

  assert.equal(AVG_LOGISTICS_CATALOG.source, 'avglogistics')
  assert.equal(AVG_LOGISTICS_CATALOG.companyName, 'AVG Logistics')
  assert.equal(AVG_LOGISTICS_CATALOG.officialBrandName, 'AVG Logistics Limited')
  assert.equal(AVG_LOGISTICS_CATALOG.adapter, 'script')
  assert.equal(AVG_LOGISTICS_CATALOG.companyCareerPage, 'https://avglogistics.com/careers')
  assert.equal(AVG_LOGISTICS_CATALOG.homepageUrl, 'https://avglogistics.com/')
  assert.equal(AVG_LOGISTICS_CATALOG.robotsTxtUrl, 'https://avglogistics.com/robots.txt')
  assert.equal(AVG_LOGISTICS_CATALOG.sitemapUrl, 'https://www.avglogistics.com/sitemap.xml')
  assert.deepEqual(AVG_LOGISTICS_CATALOG.noPublicJobRouteUrls, [
    'https://avglogistics.com/jobs',
    'https://avglogistics.com/job',
    'https://avglogistics.com/current-openings',
    'https://avglogistics.com/openings',
    'https://avglogistics.com/work-with-us',
    'https://avglogistics.com/join-us',
  ])
  assert.equal(AVG_LOGISTICS_CATALOG.operationsPortalUrl, 'https://avglogistics.in/')
  assert.equal(AVG_LOGISTICS_CATALOG.operationsPortalCareersUrl, 'https://avglogistics.in/careers')
  assert.equal(AVG_LOGISTICS_CATALOG.companyDomain, 'avglogistics.com')
  assert.equal(AVG_LOGISTICS_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(AVG_LOGISTICS_CATALOG.countryFilter, 'India')
  assert.equal(
    AVG_LOGISTICS_CATALOG.paginationStrategy,
    'opening-and-closing-current-configured-public-surface',
  )
  assert.equal(
    AVG_LOGISTICS_CATALOG.extractionStrategy,
    'current-employer-public-intake-or-unqualified-panel-observations;unknown-native-inventory',
  )
  assert.equal(AVG_LOGISTICS_CATALOG.parser, 'custom-script')
  assert.equal(AVG_LOGISTICS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AVG_LOGISTICS_CATALOG.verifiedOn, null)
  assert.match(AVG_LOGISTICS_CATALOG.verifiedSurfaceSummary,/native vacancy model.*unknown/i)
  assert.doesNotMatch(AVG_LOGISTICS_CATALOG.verifiedSurfaceSummary,/no trustworthy public jobs surface/i)
  assert.equal(AVG_LOGISTICS_CATALOG.dryRunFile, 'avglogistics/jobs.json')
  assert.equal(AVG_LOGISTICS_CATALOG.modulePath, avgLogisticsModulePath)










  assert.equal(avgLogistics.PROVIDER_METADATA.source, AVG_LOGISTICS_CATALOG.source)
  assert.equal(avgLogistics.PROVIDER_METADATA.companyName, AVG_LOGISTICS_CATALOG.companyName)
  assert.equal(avgLogistics.PROVIDER_METADATA.sitemapUrl, AVG_LOGISTICS_CATALOG.sitemapUrl)
  assert.equal(
    avgLogistics.PROVIDER_METADATA.operationsPortalCareersUrl,
    AVG_LOGISTICS_CATALOG.operationsPortalCareersUrl,
  )
})

test('AVG Logistics local catalog hydrates into coverage without needing an alias entry', async () => {
  const { AVG_LOGISTICS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AVG_LOGISTICS_CATALOG)

  assert.equal(provider.companyName, 'AVG Logistics')
  assert.equal(provider.companyDomain, 'avglogistics.com')
  assert.match(provider.modulePath, /avglogistics[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /avglogistics[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AVG Logistics\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AVG Logistics', 'avglogistics', 'AVG Logistics']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AVG Logistics'), false)
})

test('buildScrapers and company coverage resolve AVG Logistics from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avglogistics')
  const scraper = buildScrapers().find((item) => item.name === 'avglogistics')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AVG Logistics')
  assert.equal(provider.companyCareerPage, 'https://avglogistics.com/careers')
  assert.match(scraper.dryRunFile, /avglogistics[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AVG Logistics\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AVG Logistics', 'avglogistics', 'AVG Logistics']],
  )
})
