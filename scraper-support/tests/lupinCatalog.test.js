import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const lupinModulePath = path.resolve(currentDir, '../../scraper/lupin/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lupin/catalog.js')
  } catch {
    assert.fail('Expected Lupin catalog module at ../../scraper/lupin/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lupin/script.js')
  } catch {
    assert.fail('Expected Lupin scraper module at ../../scraper/lupin/script.js')
  }
}

test('Lupin historical local descriptor preserves its original declared surface', async () => {
  const { LUPIN_CATALOG } = await loadCatalogModule()
  const lupin = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LUPIN_CATALOG)

  assert.equal(LUPIN_CATALOG.source, 'lupin')
  assert.equal(LUPIN_CATALOG.companyName, 'Lupin')
  assert.equal(LUPIN_CATALOG.officialBrandName, 'Lupin')
  assert.equal(LUPIN_CATALOG.adapter, 'script')
  assert.equal(LUPIN_CATALOG.modulePath, lupinModulePath)
  assert.equal(LUPIN_CATALOG.dryRunFile, 'lupin/jobs.json')
  assert.equal(LUPIN_CATALOG.homepageUrl, 'https://www.lupin.com/')
  assert.equal(LUPIN_CATALOG.companyCareerPage, 'https://careers.lupin.com/content/Current-Opportunities/')
  assert.equal(
    LUPIN_CATALOG.indiaJobsPageUrl,
    'https://careers.lupin.com/go/Lupin-India/9891200/?q=&sortColumn=referencedate&sortDirection=desc',
  )
  assert.equal(LUPIN_CATALOG.companyDomain, 'lupin.com')
  assert.equal(LUPIN_CATALOG.verifiedPublicJobCount, 51)
  assert.equal(LUPIN_CATALOG.atsPlatform, 'successfactors')
  assert.equal(LUPIN_CATALOG.countryFilter, 'India')
  assert.equal(LUPIN_CATALOG.paginationStrategy, 'path-offset-pages-25-results-per-page')
  assert.equal(LUPIN_CATALOG.extractionStrategy, 'india-search-results-table+detail-pages')
  assert.equal(LUPIN_CATALOG.parser, 'custom-script')
  assert.equal(LUPIN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LUPIN_CATALOG.verifiedOn, '2026-07-16')
  assert.match(LUPIN_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(LUPIN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.lupin\.com\//i)
  assert.match(LUPIN_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.lupin\.com\/content\/Current-Opportunities\//i)
  assert.match(
    LUPIN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.lupin\.com\/go\/Lupin-India\/9891200\//i,
  )
  assert.match(LUPIN_CATALOG.verifiedSurfaceSummary, /51 live India jobs/i)

  assert.equal(provider.source, 'lupin')
  assert.equal(provider.companyName, 'Lupin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.lupin.com/content/Current-Opportunities/')
  assert.equal(provider.companyDomain, 'lupin.com')
  assert.match(provider.modulePath, /lupin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lupin[\\/]jobs\.json$/i)

  assert.equal(lupin.PROVIDER_METADATA.source, provider.source)
  assert.equal(lupin.PROVIDER_METADATA.indiaJobsPageUrl, LUPIN_CATALOG.indiaJobsPageUrl)
  assert.equal(lupin.PROVIDER_METADATA.verifiedPublicJobCount,null)
  assert.equal(lupin.PROVIDER_METADATA.verifiedOn,null)
  assert.equal(lupin.PROVIDER_METADATA.sourceScopeComplete,false)
})

test('Lupin exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { LUPIN_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Lupin\n',
    catalog: [hydrateProviderCatalogEntry(LUPIN_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lupin', 'lupin', 'Lupin']],
  )
})
