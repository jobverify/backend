import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cbtstechnologysolutionsindiallp/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cbtstechnologysolutionsindiallp/catalog.js')
  } catch {
    assert.fail('Expected CBTS Technology Solutions India LLP catalog module at ../../scraper/cbtstechnologysolutionsindiallp/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('CBTS Technology Solutions India LLP local catalog captures the verified first-party CBTS careers page and linked Eightfold board', async () => {
  const { CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG)

  assert.equal(defaultCatalog, CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG)
  assert.equal(provider.source, 'cbtstechnologysolutionsindiallp')
  assert.equal(provider.companyName, 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP')
  assert.equal(provider.officialBrandName, 'CBTS India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.cbts.com/')
  assert.equal(provider.companyCareerPage, 'https://www.cbts.com/careers')
  assert.equal(provider.ripplingBoardUrl, 'https://ats.rippling.com/cbtsindia/jobs')
  assert.equal(provider.ripplingBoardSlug, 'cbtsindia')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-eightfold-offset-limit')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+linked-eightfold-board-api+india-location-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cbts.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\.cbts\.com\/careers/i)
})

test('CBTS TECHNOLOGY SOLUTIONS INDIA LLP exact backlog row resolves from the local provider contract', async () => {
  const { CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP\n',
    catalog: [buildProvider(CBTS_TECHNOLOGY_SOLUTIONS_INDIA_LLP_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CBTS TECHNOLOGY SOLUTIONS INDIA LLP', 'cbtstechnologysolutionsindiallp', 'CBTS TECHNOLOGY SOLUTIONS INDIA LLP']],
  )
})
