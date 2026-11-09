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
const oppoModulePath = path.resolve(currentDir, '../../scraper/oppo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oppo/catalog.js')
  } catch {
    assert.fail('Expected Oppo catalog module at ../../scraper/oppo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/oppo/script.js')
  } catch {
    assert.fail('Expected Oppo scraper module at ../../scraper/oppo/script.js')
  }
}

test('Oppo local catalog captures the verified official public jobs APIs and India-only filter', async () => {
  const { OPPO_CATALOG } = await loadCatalogModule()
  const oppo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(OPPO_CATALOG)

  assert.equal(provider.source, 'oppo')
  assert.equal(provider.companyName, 'Oppo')
  assert.equal(provider.officialBrandName, 'OPPO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://career.oppo.com/official/oppo')
  assert.equal(provider.companyCareerPage, 'https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT')
  assert.equal(provider.jobsBoardUrl, 'https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT')
  assert.equal(provider.campusJobsBoardUrl, 'https://careers.oppo.com/university/oppo/campus/post')
  assert.equal(provider.socialApiUrl, 'https://career.oppo.com/ats-candidate-api/open-api/position/queryPositionList')
  assert.equal(provider.campusApiUrl, 'https://careers.oppo.com/openapi/position/pageNew')
  assert.equal(provider.companyDomain, 'oppo.com')
  assert.equal(provider.atsPlatform, 'official-company-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'page-number-api-pagination-across-social-and-campus-public-position-feeds',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-social-and-campus-shells+public-social-and-campus-position-apis+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /oppo[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, oppoModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /career\.oppo\.com\/official\/oppo/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\.oppo\.com\/university\/oppo/i)
  assert.match(provider.verifiedSurfaceSummary, /queryPositionList/i)
  assert.match(provider.verifiedSurfaceSummary, /pageNew/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oppo'), false)

  assert.equal(oppo.PROVIDER_METADATA.source, OPPO_CATALOG.source)
  assert.equal(oppo.PROVIDER_METADATA.socialApiUrl, OPPO_CATALOG.socialApiUrl)
  assert.equal(oppo.PROVIDER_METADATA.campusApiUrl, OPPO_CATALOG.campusApiUrl)
})

test('Oppo backlog row matches directly from the local catalog without alias churn', async () => {
  const { OPPO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Oppo\n',
    catalog: [hydrateProviderCatalogEntry(OPPO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oppo', 'oppo', 'Oppo']],
  )
})

test('getScraperCatalog exposes Oppo as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oppo')
  const scraper = buildScrapers().find((item) => item.name === 'oppo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Oppo')
  assert.equal(
    provider.companyCareerPage,
    'https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT',
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oppo'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Oppo\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oppo', 'oppo', 'Oppo']],
  )
})
