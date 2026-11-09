import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/headout/catalog.js')
  } catch {
    assert.fail('Expected Headout catalog module at ../../scraper/headout/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/headout/script.js')
  } catch {
    assert.fail('Expected Headout scraper module at ../../scraper/headout/script.js')
  }
}

test('Headout local catalog captures the verified first-party Greenhouse contract', async () => {
  const { HEADOUT_CATALOG } = await loadCatalogModule()
  const headout = await loadScriptModule()

  assert.equal(HEADOUT_CATALOG.source, 'headout')
  assert.equal(HEADOUT_CATALOG.companyName, 'Headout')
  assert.equal(HEADOUT_CATALOG.officialBrandName, 'Headout')
  assert.equal(HEADOUT_CATALOG.adapter, 'script')
  assert.equal(HEADOUT_CATALOG.companyCareerPage, 'https://www.headout.com/careers/')
  assert.equal(HEADOUT_CATALOG.companyDomain, 'headout.com')
  assert.equal(HEADOUT_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(HEADOUT_CATALOG.countryFilter, 'India')
  assert.equal(
    HEADOUT_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-multi-board-greenhouse-jobs-api',
  )
  assert.equal(
    HEADOUT_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-open-roles-loader+multi-board-greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(HEADOUT_CATALOG.parser, 'custom-script')
  assert.equal(HEADOUT_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HEADOUT_CATALOG.modulePath, '../../scraper/headout/script.js')
  assert.deepEqual(HEADOUT_CATALOG.greenhouseBoardSlugs, ['headoutcareers', 'headoutreferrals'])
  assert.equal(HEADOUT_CATALOG.verifiedOn, '2026-08-15')
  assert.equal(HEADOUT_CATALOG.dryRunFile, 'headout/jobs.json')
  assert.match(HEADOUT_CATALOG.verifiedSurfaceSummary, /headout\.com\/careers/i)
  assert.match(HEADOUT_CATALOG.verifiedSurfaceSummary, /Greenhouse/i)
  assert.match(HEADOUT_CATALOG.verifiedSurfaceSummary, /assets\.headout\.com/i)

  assert.equal(headout.PROVIDER_METADATA.source, HEADOUT_CATALOG.source)
  assert.equal(headout.CAREERS_URL, HEADOUT_CATALOG.companyCareerPage)
})

test('Headout exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { HEADOUT_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Headout\n',
    catalog: [HEADOUT_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Headout', 'headout', 'Headout']],
  )
})

test('getScraperCatalog includes Headout as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'headout')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Headout')
  assert.equal(provider.companyCareerPage, 'https://www.headout.com/careers/')
  assert.equal(provider.companyDomain, 'headout.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /headout[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Headout scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'headout')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'headout')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /headout[\\/]jobs\.json$/i)
})
