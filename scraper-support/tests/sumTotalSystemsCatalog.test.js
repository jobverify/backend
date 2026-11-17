import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sumtotalsystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sumtotalsystems/catalog.js')
  } catch {
    assert.fail('Expected SumTotal Systems catalog module at ../../scraper/sumtotalsystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sumtotalsystems/script.js')
  } catch {
    assert.fail('Expected SumTotal Systems scraper module at ../../scraper/sumtotalsystems/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('SumTotal Systems local catalog captures the verified redirect to generic Cornerstone careers rather than an exact-name jobs surface', async () => {
  const { SUMTOTAL_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sumTotalSystems = await loadScriptModule()
  const provider = buildCatalogReadyProvider(SUMTOTAL_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, SUMTOTAL_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'sumtotalsystems')
  assert.equal(provider.companyName, 'SumTotal Systems')
  assert.equal(provider.officialBrandName, 'SumTotal Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sumtotalsystems.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sumtotalsystems.com/about')
  assert.equal(provider.redirectHomepageUrl, 'https://www.cornerstoneondemand.com/')
  assert.equal(provider.redirectCompanyUrl, 'https://www.cornerstoneondemand.com/company/')
  assert.equal(provider.parentCareersUrl, 'https://www.cornerstoneondemand.com/careers/')
  assert.equal(
    provider.parentOpenPositionsUrl,
    'https://cornerstone.csod.com/ux/ats/careersite/2/home?c=cornerstone',
  )
  assert.equal(provider.upstreamCompanyName, 'Cornerstone')
  assert.equal(provider.atsPlatform, 'current-own-redirect-and-generic-parent-recruitment-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'exact-own-root308-declared-parent-home-careers-product-and-anonymous-ats-shell-opening-closing',
  )
  assert.equal(
    provider.extractionStrategy,
    'whole-current-target-parent-relationship-and-generic-parent-handoff+original-redirect-challenge-guard+target-role-employer-country-criteria-application-and-company-scope-unqualified',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sumtotalsystems.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sumtotalsystems\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cornerstoneondemand\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cornerstoneondemand\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/cornerstone\.csod\.com\/ux\/ats\/careersite\/2\/home\?c=cornerstone/i)
  assert.match(provider.verifiedSurfaceSummary, /not a distinct SumTotal Systems public jobs surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sumtotalsystems[\\/]jobs\.json$/i)

  assert.equal(sumTotalSystems.PROVIDER_METADATA.source, provider.source)
  assert.equal(sumTotalSystems.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(sumTotalSystems.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('SumTotal Systems exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { SUMTOTAL_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SumTotal Systems\n',
    catalog: [buildCatalogReadyProvider(SUMTOTAL_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SumTotal Systems', 'sumtotalsystems', 'SumTotal Systems']],
  )
})
