import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAgiloftIndiaCatalog = async () => {
  try {
    return await import('../../scraper/agiloftindia/catalog.js')
  } catch {
    assert.fail('Expected Agiloft India catalog module at ../../scraper/agiloftindia/catalog.js')
  }
}

test('Agiloft India catalog captures the runtime native inventory contract', async () => {
  const {
    AGILOFT_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadAgiloftIndiaCatalog()

  assert.equal(defaultCatalog, AGILOFT_INDIA_CATALOG)
  assert.equal(AGILOFT_INDIA_CATALOG.source, 'agiloftindia')
  assert.equal(AGILOFT_INDIA_CATALOG.companyName, 'Agiloft India')
  assert.equal(AGILOFT_INDIA_CATALOG.officialBrandName, 'Agiloft')
  assert.equal(AGILOFT_INDIA_CATALOG.adapter, 'script')
  assert.equal(AGILOFT_INDIA_CATALOG.companyCareerPage, 'https://www.agiloft.com/careers/')
  assert.equal(AGILOFT_INDIA_CATALOG.companyDomain, 'agiloft.com')
  assert.equal(
    AGILOFT_INDIA_CATALOG.officialCareersAliasUrl,
    'https://www.agiloft.com/about-us/careers/',
  )
  assert.equal(
    AGILOFT_INDIA_CATALOG.officialLeverBoardUrl,
    'https://jobs.lever.co/agiloft',
  )
  assert.equal(AGILOFT_INDIA_CATALOG.atsPlatform, 'lever')
  assert.equal(AGILOFT_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    AGILOFT_INDIA_CATALOG.paginationStrategy,
    'corporate-advertised-full-feed-board-details-and-closing-reconciliation',
  )
  assert.equal(
    AGILOFT_INDIA_CATALOG.extractionStrategy,
    'runtime-corporate-handoff+full-native-inventory+all-visible-details+primary-secondary-countries+closing-membership+india-filter',
  )
  assert.equal(AGILOFT_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(AGILOFT_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AGILOFT_INDIA_CATALOG.verifiedOn, '2026-10-27')
  assert.match(AGILOFT_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.agiloft\.com\/careers\//)
  assert.match(AGILOFT_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/agiloft/)
  assert.match(AGILOFT_INDIA_CATALOG.verifiedSurfaceSummary, /not live inventory evidence/i)
  assert.match(AGILOFT_INDIA_CATALOG.modulePath, /agiloftindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Agiloft India'), false)
})

test('Agiloft India backlog matching works directly from the local catalog metadata', async () => {
  const { AGILOFT_INDIA_CATALOG } = await loadAgiloftIndiaCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Agiloft India,\n',
    catalog: [AGILOFT_INDIA_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Agiloft India', 'agiloftindia', 'Agiloft India']],
  )
})

test('buildScrapers and company coverage resolve Agiloft India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agiloftindia')
  const scraper = buildScrapers().find((item) => item.name === 'agiloftindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Agiloft India')
  assert.equal(provider.companyCareerPage, 'https://www.agiloft.com/careers/')
  assert.match(scraper.dryRunFile, /agiloftindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Agiloft India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Agiloft India', 'agiloftindia', 'Agiloft India']],
  )
})
