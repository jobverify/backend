import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const greavesElectricMobilityModulePath = path.resolve(currentDir, '../../scraper/greaveselectricmobility/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/greaveselectricmobility/catalog.js')
  } catch {
    assert.fail('Expected Greaves Electric Mobility catalog module at ../../scraper/greaveselectricmobility/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/greaveselectricmobility/script.js')
  } catch {
    assert.fail('Expected Greaves Electric Mobility scraper module at ../../scraper/greaveselectricmobility/script.js')
  }
}

test('Greaves Electric Mobility local catalog captures the verified first-party careers page and fail-closed Keka handoff state without alias churn', async () => {
  const { GREAVES_ELECTRIC_MOBILITY_CATALOG } = await loadCatalogModule()
  const greavesElectricMobility = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(GREAVES_ELECTRIC_MOBILITY_CATALOG)

  assert.equal(provider.source, 'greaveselectricmobility')
  assert.equal(provider.companyName, 'Greaves Electric Mobility')
  assert.equal(provider.officialBrandName, 'Greaves Electric Mobility Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://greaveselectricmobility.com/')
  assert.equal(provider.companyCareerPage, 'https://greaveselectricmobility.com/careers')
  assert.equal(provider.officialCareersHandoffUrl, 'https://peopleatgems.kekahire.com/')
  assert.equal(provider.companyDomain, 'greaveselectricmobility.com')
  assert.equal(provider.atsPlatform, 'keka-handoff-unverifiable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-plus-external-keka-handoff-no-verifiable-public-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-handoff+transport-unverifiable-fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/greaveselectricmobility\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/peopleatgems\.kekahire\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /View Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Connect Timeout Error|trust relationship/i)
  assert.match(provider.verifiedSurfaceSummary, /fails closed/i)
  assert.match(provider.dryRunFile, /greaveselectricmobility[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /greaveselectricmobility[\\/]script\.js$/i)
  assert.equal(provider.modulePath, greavesElectricMobilityModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Greaves Electric Mobility'), false)

  assert.equal(
    greavesElectricMobility.PROVIDER_METADATA.officialCareersHandoffUrl,
    GREAVES_ELECTRIC_MOBILITY_CATALOG.officialCareersHandoffUrl,
  )
  assert.equal(
    greavesElectricMobility.PROVIDER_METADATA.companyCareerPage,
    GREAVES_ELECTRIC_MOBILITY_CATALOG.companyCareerPage,
  )
})

test('Greaves Electric Mobility backlog row matches directly from local provider metadata without alias churn', async () => {
  const { GREAVES_ELECTRIC_MOBILITY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Greaves Electric Mobility\n',
    catalog: [hydrateProviderCatalogEntry(GREAVES_ELECTRIC_MOBILITY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Greaves Electric Mobility', 'greaveselectricmobility', 'Greaves Electric Mobility']],
  )
})
