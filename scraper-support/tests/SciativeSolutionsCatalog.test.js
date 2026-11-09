import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sciative/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sciative/catalog.js')
  } catch {
    assert.fail('Expected Sciative Solutions catalog module at ../../scraper/sciative/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sciative/script.js')
  } catch {
    assert.fail('Expected Sciative Solutions scraper module at ../../scraper/sciative/script.js')
  }
}

test('Sciative Solutions local catalog captures the verified first-party careers API surface', async () => {
  const { SCIATIVE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sciative = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SCIATIVE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, SCIATIVE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'sciative')
  assert.equal(provider.companyName, 'Sciative Solutions')
  assert.equal(provider.officialBrandName, 'Sciative')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://sciative.com/')
  assert.equal(provider.companyCareerPage, 'https://sciative.com/careers')
  assert.equal(provider.careersApiUrl, 'https://sciative.com/backend/get_career_item/1')
  assert.equal(provider.companyDomain, 'sciative.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-json-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-public-json-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-careers-api+same-page-apply-flow',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-26')
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 26, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sciative\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sciative\.com\/backend\/get_career_item\/1/i)
  assert.match(provider.verifiedSurfaceSummary, /Devops Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager - Hospality Domain/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sciative[\\/]jobs\.json$/i)

  assert.equal(sciative.PROVIDER_METADATA.source, provider.source)
  assert.equal(sciative.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Sciative Solutions exact backlog row resolves from the local provider contract', async () => {
  const { SCIATIVE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sciative Solutions\n',
    catalog: [hydrateProviderCatalogEntry(SCIATIVE_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sciative Solutions', 'sciative', 'Sciative Solutions']],
  )
})
