import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mastekModulePath = path.resolve(currentDir, '../../scraper/mastek/script.js')

const loadMastekCatalog = async () => {
  try {
    return await import('../../scraper/mastek/catalog.js')
  } catch {
    assert.fail('Expected Mastek catalog module at ../../scraper/mastek/catalog.js')
  }
}

test('Mastek local catalog captures the verified mixed-global board with India-only normalization', async () => {
  const {
    MASTEK_CATALOG,
    default: defaultCatalog,
  } = await loadMastekCatalog()
  const provider = hydrateProviderCatalogEntry(MASTEK_CATALOG)

  assert.equal(defaultCatalog, MASTEK_CATALOG)
  assert.equal(provider.source, 'mastek')
  assert.equal(provider.companyName, 'Mastek')
  assert.equal(provider.officialBrandName, 'Mastek Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialBrandSiteUrl, 'https://www.mastek.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mastek.com/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://careers.mastek.com/search/')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.mastek.com/job/Oracle-FCCS-Functional-Consultant/57886344/',
  )
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 56)
  assert.equal(provider.paginationStrategy, 'first-party-search-startrow-query')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+first-party-search-page+job-tiles+detail-pages+talentcommunity-apply-handoff+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.mastek.com')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.dryRunFile, /mastek[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /mastek[\\/]script\.js$/i)
  assert.equal(provider.modulePath, mastekModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mastek\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.mastek\.com\/search\//i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(provider.verifiedSurfaceSummary, /Showing 1 to 12 of 56 Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /28 India-coded postings/i)
  assert.match(provider.verifiedSurfaceSummary, /Oracle FCCS Functional Consultant/i)
})

test('Mastek exact backlog row matches directly from the local catalog without aliases', async () => {
  const { MASTEK_CATALOG } = await loadMastekCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Mastek\n',
    catalog: [hydrateProviderCatalogEntry(MASTEK_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mastek', 'mastek', 'Mastek']],
  )
})
