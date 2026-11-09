import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const topprModulePath = path.resolve(currentDir, '../../scraper/toppr/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/toppr/catalog.js')
  } catch {
    assert.fail('Expected Toppr catalog module at ../../scraper/toppr/catalog.js')
  }
}

const loadTopprModule = async () => {
  try {
    return await import('../../scraper/toppr/script.js')
  } catch {
    assert.fail('Expected Toppr scraper module at ../../scraper/toppr/script.js')
  }
}

test('Toppr local catalog captures the fail-closed exact-name sentinel metadata without alias churn', async () => {
  const { TOPPR_CATALOG } = await loadCatalogModule()
  const toppr = await loadTopprModule()
  const provider = hydrateProviderCatalogEntry(TOPPR_CATALOG)

  assert.equal(provider.source, 'toppr')
  assert.equal(provider.companyName, 'Toppr')
  assert.equal(provider.officialBrandName, 'Toppr')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.toppr.com/')
  assert.equal(provider.companyCareerPage, 'https://www.toppr.com/careers')
  assert.equal(provider.standaloneJobsBoardUrl, 'https://toppr.jobsoid.com/')
  assert.equal(provider.companyDomain, 'toppr.com')
  assert.equal(provider.atsPlatform, 'exact-name-domain-unverifiable-no-trustworthy-first-party-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'expected-toppr-careers-route-unverifiable-plus-unlinked-jobsoid-board')
  assert.equal(
    provider.extractionStrategy,
    'exact-name-careers-route-unverifiable+standalone-jobsoid-board-not-linked-from-first-party-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.toppr\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.toppr\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/toppr\.jobsoid\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /fails closed/i)
  assert.match(provider.dryRunFile, /toppr[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /toppr[\\/]script\.js$/i)
  assert.equal(provider.modulePath, topprModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Toppr'), false)

  assert.equal(toppr.PROVIDER_METADATA.source, TOPPR_CATALOG.source)
  assert.equal(toppr.PROVIDER_METADATA.companyCareerPage, TOPPR_CATALOG.companyCareerPage)
  assert.equal(toppr.PROVIDER_METADATA.standaloneJobsBoardUrl, TOPPR_CATALOG.standaloneJobsBoardUrl)
})

test('Toppr backlog row matches directly from local provider metadata without alias churn', async () => {
  const { TOPPR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Toppr\n',
    catalog: [hydrateProviderCatalogEntry(TOPPR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Toppr', 'toppr', 'Toppr']],
  )
})
