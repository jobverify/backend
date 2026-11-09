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
const oneCardModulePath = path.resolve(currentDir, '../../scraper/onecard/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/onecard/catalog.js')
  } catch {
    assert.fail('Expected OneCard catalog module at ../../scraper/onecard/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/onecard/script.js')
  } catch {
    assert.fail('Expected OneCard scraper module at ../../scraper/onecard/script.js')
  }
}

test('OneCard local catalog captures the verified Friday, August 14, 2026 gated-handoff and broken-public-api contract', async () => {
  const { ONECARD_CATALOG } = await loadCatalogModule()
  const oneCard = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ONECARD_CATALOG)

  assert.equal(provider.source, 'onecard')
  assert.equal(provider.companyName, 'OneCard')
  assert.equal(provider.officialBrandName, 'OneCard')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.getonecard.app/careers/')
  assert.equal(provider.companyDomain, 'getonecard.app')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-gated-handoff-plus-broken-public-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-gated-handoff-plus-broken-public-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-fpl-handoff-js-gate+verified-broken-public-jobs-api-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.officialCareersHandoffUrl, 'https://www.fplabs.tech/careers/')
  assert.equal(
    provider.officialJobsApiUrl,
    'https://ibffpublic6f2461135ffd1b6a80db296ec15abf.onrender.com/hr/jobs',
  )
  assert.equal(provider.officialJobsApiKey, 'hr-read-only')
  assert.equal(provider.officialApplyUrl, 'mailto:careers@getonecard.app')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.dryRunFile, /onecard[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, oneCardModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.getonecard\.app\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fplabs\.tech\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/ibffpublic6f2461135ffd1b6a80db296ec15abf\.onrender\.com\/hr\/jobs/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/paa\.fplabs\.tech\/proxy\/CRUD\/api\/test-jobs\?populate=\*/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /HTTP 307/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 500/i)
  assert.match(provider.verifiedSurfaceSummary, /There is no trustworthy public OneCard jobs listing surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OneCard'), false)

  assert.equal(oneCard.PROVIDER_METADATA.source, ONECARD_CATALOG.source)
  assert.equal(oneCard.PROVIDER_METADATA.companyName, ONECARD_CATALOG.companyName)
  assert.equal(
    oneCard.PROVIDER_METADATA.officialJobsApiUrl,
    ONECARD_CATALOG.officialJobsApiUrl,
  )
})

test('OneCard backlog row matches directly from the local catalog without alias churn', async () => {
  const { ONECARD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OneCard\n',
    catalog: [hydrateProviderCatalogEntry(ONECARD_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OneCard', 'onecard', 'OneCard']],
  )
})

test('getScraperCatalog exposes OneCard as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'onecard')
  const scraper = buildScrapers().find((item) => item.name === 'onecard')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OneCard')
  assert.equal(provider.companyCareerPage, 'https://www.getonecard.app/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OneCard'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OneCard\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OneCard', 'onecard', 'OneCard']],
  )
})
