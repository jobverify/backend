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
const pineLabsModulePath = path.resolve(currentDir, '../../scraper/pinelabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pinelabs/catalog.js')
  } catch {
    assert.fail('Expected Pine Labs catalog module at ../../scraper/pinelabs/catalog.js')
  }
}

test('Pine Labs local catalog captures the verified first-party careers page with no public board signal', async () => {
  const {
    PINE_LABS_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PINE_LABS_CATALOG)

  assert.equal(defaultCatalog, PINE_LABS_CATALOG)
  assert.equal(provider.source, 'pinelabs')
  assert.equal(provider.companyName, 'Pine Labs')
  assert.equal(provider.officialBrandName, 'Pine Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.pinelabs.com/')
  assert.equal(provider.companyCareerPage, 'https://www.pinelabs.com/careers')
  assert.equal(provider.companyDomain, 'pinelabs.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page-without-public-job-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pinelabs\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job board/i)
  assert.equal(provider.modulePath, pineLabsModulePath)
  assert.match(provider.dryRunFile, /pinelabs[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pine Labs'), false)
})

test('Pine Labs backlog row matches directly from the local catalog metadata', async () => {
  const { PINE_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pine Labs\n',
    catalog: [PINE_LABS_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pine Labs', 'pinelabs', 'Pine Labs']],
  )
})

test('getScraperCatalog exposes Pine Labs as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pinelabs')
  const scraper = buildScrapers().find((item) => item.name === 'pinelabs')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pine Labs')
  assert.equal(provider.companyCareerPage, 'https://www.pinelabs.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pine Labs'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pine Labs\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pine Labs', 'pinelabs', 'Pine Labs']],
  )
})
