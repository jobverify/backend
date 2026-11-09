import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const archiesModulePath = path.resolve(currentDir, '../../scraper/archies/script.js')

const loadArchiesCatalog = async () => {
  try {
    return await import('../../scraper/archies/catalog.js')
  } catch {
    assert.fail('Expected Archies catalog module at ../../scraper/archies/catalog.js')
  }
}

test('Archies catalog captures the verified first-party no-public-jobs storefront surface', async () => {
  const { ARCHIES_CATALOG } = await loadArchiesCatalog()
  const provider = hydrateProviderCatalogEntry(ARCHIES_CATALOG)

  assert.equal(provider.source, 'archies')
  assert.equal(provider.companyName, 'Archies')
  assert.equal(provider.officialBrandName, 'Archies Online')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://archiesonline.com/')
  assert.equal(provider.companyDomain, 'archiesonline.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-crawl-surface-plus-common-careers-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-robots-and-page-sitemap-without-careers+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, archiesModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/archiesonline\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/archiesonline\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/archiesonline\.com\/sitemap\.xml/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/archiesonline\.com\/sitemap_pages_1\.xml\?from=693794865301&to=710639354005/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/archiesonline\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/archiesonline\.com\/work-with-us/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Archies backlog row matches directly from provider metadata without alias churn', async () => {
  const { ARCHIES_CATALOG } = await loadArchiesCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Archies\n',
    catalog: [hydrateProviderCatalogEntry(ARCHIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Archies', 'archies', 'Archies']],
  )
})

test('buildScrapers and company coverage resolve Archies from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'archies')
  const scraper = buildScrapers().find((item) => item.name === 'archies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Archies')
  assert.equal(provider.companyCareerPage, 'https://archiesonline.com/')
  assert.match(scraper.dryRunFile, /archies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Archies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Archies', 'archies', 'Archies']],
  )
})
