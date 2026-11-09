import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAptosIndiaCatalog = async () => {
  try {
    return await import('../../scraper/aptosindia.workday/catalog.js')
  } catch {
    assert.fail('Expected Aptos India catalog module at ../../scraper/aptosindia.workday/catalog.js')
  }
}

test('Aptos India catalog captures the verified first-party Aptos careers handoff and public Workday metadata', async () => {
  const {
    APTOS_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadAptosIndiaCatalog()

  assert.equal(defaultCatalog, APTOS_INDIA_CATALOG)
  assert.equal(APTOS_INDIA_CATALOG.source, 'aptosindia')
  assert.equal(APTOS_INDIA_CATALOG.companyName, 'Aptos India')
  assert.equal(APTOS_INDIA_CATALOG.officialBrandName, 'Aptos')
  assert.equal(APTOS_INDIA_CATALOG.adapter, 'script')
  assert.equal(APTOS_INDIA_CATALOG.companyCareerPage, 'https://www.aptos.com/careers')
  assert.equal(APTOS_INDIA_CATALOG.companyDomain, 'aptos.com')
  assert.equal(APTOS_INDIA_CATALOG.officialHomepageUrl, 'https://www.aptos.com/')
  assert.equal(
    APTOS_INDIA_CATALOG.officialWorkdayBoardUrl,
    'https://aptos.wd108.myworkdayjobs.com/Aptos',
  )
  assert.equal(
    APTOS_INDIA_CATALOG.jobsApiUrl,
    'https://aptos.wd108.myworkdayjobs.com/wday/cxs/aptos/Aptos/jobs',
  )
  assert.equal(APTOS_INDIA_CATALOG.verifiedIndiaLocationName, 'IN Bangalore Office')
  assert.equal(APTOS_INDIA_CATALOG.atsPlatform, 'workday')
  assert.equal(APTOS_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    APTOS_INDIA_CATALOG.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-locations-facet',
  )
  assert.equal(
    APTOS_INDIA_CATALOG.extractionStrategy,
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facet+filtered-workday-jobs-api',
  )
  assert.equal(APTOS_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(APTOS_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(APTOS_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.match(APTOS_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.aptos\.com\/careers/i)
  assert.match(APTOS_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/aptos\.wd108\.myworkdayjobs\.com\/Aptos/i)
  assert.match(
    APTOS_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/aptos\.wd108\.myworkdayjobs\.com\/wday\/cxs\/aptos\/Aptos\/jobs/i,
  )
  assert.match(APTOS_INDIA_CATALOG.verifiedSurfaceSummary, /\b3 India roles\b/i)
  assert.match(APTOS_INDIA_CATALOG.verifiedSurfaceSummary, /IN Bangalore Office/i)
  assert.match(APTOS_INDIA_CATALOG.modulePath, /aptosindia\.workday[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aptos India'), false)
})

test('Aptos India backlog matching works directly from the local catalog metadata', async () => {
  const { APTOS_INDIA_CATALOG } = await loadAptosIndiaCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Aptos India\n',
    catalog: [APTOS_INDIA_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aptos India', 'aptosindia', 'Aptos India']],
  )
})

test('buildScrapers and company coverage resolve Aptos India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aptosindia')
  const scraper = buildScrapers().find((item) => item.name === 'aptosindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aptos India')
  assert.equal(provider.companyCareerPage, 'https://www.aptos.com/careers')
  assert.match(scraper.dryRunFile, /aptosindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aptos India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aptos India', 'aptosindia', 'Aptos India']],
  )
})
