import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadItronIndiaCatalog = async () => {
  try {
    return await import('../../scraper/itronindia.workday/catalog.js')
  } catch {
    assert.fail('Expected Itron India catalog module at ../../scraper/itronindia.workday/catalog.js')
  }
}

test('Itron India catalog captures the verified official careers handoff and India Workday board metadata', async () => {
  const {
    ITRON_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadItronIndiaCatalog()

  assert.equal(defaultCatalog, ITRON_INDIA_CATALOG)
  assert.equal(ITRON_INDIA_CATALOG.source, 'itronindia')
  assert.equal(ITRON_INDIA_CATALOG.companyName, 'Itron India')
  assert.equal(ITRON_INDIA_CATALOG.officialBrandName, 'Itron')
  assert.equal(ITRON_INDIA_CATALOG.adapter, 'script')
  assert.equal(ITRON_INDIA_CATALOG.companyCareerPage, 'https://na.itron.com/careers')
  assert.equal(ITRON_INDIA_CATALOG.companyDomain, 'na.itron.com')
  assert.equal(ITRON_INDIA_CATALOG.officialHomepageUrl, 'https://na.itron.com/')
  assert.equal(
    ITRON_INDIA_CATALOG.officialWorkdayBoardUrl,
    'https://itron.wd5.myworkdayjobs.com/Itron',
  )
  assert.equal(
    ITRON_INDIA_CATALOG.verifiedIndiaWorkdayUrl,
    'https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(ITRON_INDIA_CATALOG.atsPlatform, 'workday')
  assert.equal(ITRON_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    ITRON_INDIA_CATALOG.paginationStrategy,
    'verified-first-party-careers-handoff-plus-india-workday-board',
  )
  assert.equal(
    ITRON_INDIA_CATALOG.extractionStrategy,
    'verified-careers-page+verified-india-workday-handoff+verified-workday-board+shared-workday-runner',
  )
  assert.equal(ITRON_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(ITRON_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ITRON_INDIA_CATALOG.verifiedOn, '2026-07-16')
  assert.match(ITRON_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/na\.itron\.com\/careers/i)
  assert.match(
    ITRON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/itron\.wd5\.myworkdayjobs\.com\/Itron\?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e/i,
  )
  assert.match(ITRON_INDIA_CATALOG.verifiedSurfaceSummary, /View Jobs in India/i)
  assert.match(ITRON_INDIA_CATALOG.modulePath, /itronindia\.workday[\\/]script\.js$/i)
})

test('Itron India backlog matching works directly from the local catalog metadata', async () => {
  const { ITRON_INDIA_CATALOG } = await loadItronIndiaCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Itron India\n',
    catalog: [ITRON_INDIA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Itron India', 'itronindia', 'Itron India']],
  )
})
