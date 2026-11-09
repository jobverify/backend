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
const pickrrModulePath = path.resolve(currentDir, '../../scraper/pickrr/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pickrr/catalog.js')
  } catch {
    assert.fail('Expected Pickrr catalog module at ../../scraper/pickrr/catalog.js')
  }
}

test('Pickrr local catalog captures the verified first-party careers-form-without-public-jobs surface', async () => {
  const {
    PICKRR_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PICKRR_CATALOG)

  assert.equal(defaultCatalog, PICKRR_CATALOG)
  assert.equal(provider.source, 'pickrr')
  assert.equal(provider.companyName, 'Pickrr')
  assert.equal(provider.officialBrandName, 'Pickrr')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://pickrr.com/')
  assert.equal(provider.companyCareerPage, 'https://pickrr.com/life-at-pickrr/')
  assert.equal(provider.companyDomain, 'pickrr.com')
  assert.equal(provider.officialSitemapUrl, 'https://pickrr.com/sitemap.xml')
  assert.equal(provider.official404CareersUrl, 'https://pickrr.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-form-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-life-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-timeout-only-first-party-routes+legacy-homepage-life-at-pickrr-sitemap-and-careers-404-fallback-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /repeated connect timeouts/i)
  assert.equal(provider.modulePath, pickrrModulePath)
  assert.match(provider.dryRunFile, /pickrr[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pickrr'), false)
})

test('Pickrr backlog row matches directly from the local catalog metadata', async () => {
  const { PICKRR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pickrr\n',
    catalog: [PICKRR_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pickrr', 'pickrr', 'Pickrr']],
  )
})

test('getScraperCatalog exposes Pickrr as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pickrr')
  const scraper = buildScrapers().find((item) => item.name === 'pickrr')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pickrr')
  assert.equal(provider.companyCareerPage, 'https://pickrr.com/life-at-pickrr/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pickrr'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pickrr\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pickrr', 'pickrr', 'Pickrr']],
  )
})
