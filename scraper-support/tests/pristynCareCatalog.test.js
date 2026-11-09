import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const pristynCareModulePath = path.resolve(currentDir, '../../scraper/pristyncare/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pristyncare/catalog.js')
  } catch {
    assert.fail('Expected Pristyn Care catalog module at ../../scraper/pristyncare/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pristyncare/script.js')
  } catch {
    assert.fail('Expected Pristyn Care scraper module at ../../scraper/pristyncare/script.js')
  }
}

test('Pristyn Care local catalog captures the official careers shell and unreachable Skillate handoff sentinel', async () => {
  const { PRISTYN_CARE_CATALOG } = await loadCatalogModule()
  const pristynCare = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PRISTYN_CARE_CATALOG)

  assert.equal(provider.source, 'pristyncare')
  assert.equal(provider.companyName, 'Pristyn Care')
  assert.equal(provider.officialBrandName, 'Pristyn Care')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.pristyncare.com/company/careers/')
  assert.equal(provider.officialJobsHandoffUrl, 'https://pristyncare.skillate.com/')
  assert.equal(provider.officialFeaturedJobsContainerClass, 'featuredPositionsJobsContainer')
  assert.equal(provider.companyDomain, 'pristyncare.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-unreachable-skillate-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation-plus-skillate-connectivity-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+empty-featured-positions-shell+unreachable-skillate-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /pristyncare[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, pristynCareModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pristyncare\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pristyncare\.skillate\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Featured Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /could not connect|fetch failed/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pristyn Care'), false)

  assert.equal(pristynCare.PROVIDER_METADATA.source, PRISTYN_CARE_CATALOG.source)
  assert.equal(pristynCare.PROVIDER_METADATA.companyName, PRISTYN_CARE_CATALOG.companyName)
  assert.equal(
    pristynCare.PROVIDER_METADATA.officialJobsHandoffUrl,
    PRISTYN_CARE_CATALOG.officialJobsHandoffUrl,
  )
})

test('Pristyn Care backlog row matches directly from the local catalog without alias churn', async () => {
  const { PRISTYN_CARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pristyn Care\n',
    catalog: [hydrateProviderCatalogEntry(PRISTYN_CARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pristyn Care', 'pristyncare', 'Pristyn Care']],
  )
})

test('getScraperCatalog exposes Pristyn Care as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pristyncare')
  const scraper = buildScrapers().find((item) => item.name === 'pristyncare')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pristyn Care')
  assert.equal(provider.companyCareerPage, 'https://www.pristyncare.com/company/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pristyn Care'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pristyn Care\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pristyn Care', 'pristyncare', 'Pristyn Care']],
  )
})
