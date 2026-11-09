import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/healthifyme/catalog.js')
  } catch {
    assert.fail('Expected HealthifyMe catalog module at ../../scraper/healthifyme/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/healthifyme/script.js')
  } catch {
    assert.fail('Expected HealthifyMe scraper module at ../../scraper/healthifyme/script.js')
  }
}

test('HealthifyMe local catalog captures the verified first-party Darwinbox handoff metadata', async () => {
  const { HEALTHIFYME_CATALOG } = await loadCatalogModule()
  const healthifyMe = await loadScriptModule()

  assert.equal(HEALTHIFYME_CATALOG.source, 'healthifyme')
  assert.equal(HEALTHIFYME_CATALOG.companyName, 'HealthifyMe')
  assert.equal(HEALTHIFYME_CATALOG.officialBrandName, 'HealthifyMe Wellness Private Limited')
  assert.equal(HEALTHIFYME_CATALOG.adapter, 'script')
  assert.equal(HEALTHIFYME_CATALOG.companyCareerPage, 'https://www.healthifyme.com/careers/')
  assert.equal(HEALTHIFYME_CATALOG.companyDomain, 'healthifyme.com')
  assert.equal(HEALTHIFYME_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(HEALTHIFYME_CATALOG.countryFilter, 'India')
  assert.equal(
    HEALTHIFYME_CATALOG.paginationStrategy,
    'browser-session-darwinbox-pagination',
  )
  assert.equal(
    HEALTHIFYME_CATALOG.extractionStrategy,
    'official-careers-page+darwinbox-listing-api',
  )
  assert.equal(HEALTHIFYME_CATALOG.parser, 'custom-script')
  assert.equal(HEALTHIFYME_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    HEALTHIFYME_CATALOG.officialCareersHandoffUrl,
    'https://healthify.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(HEALTHIFYME_CATALOG.darwinboxOrigin, 'https://healthify.darwinbox.in')
  assert.equal(HEALTHIFYME_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(HEALTHIFYME_CATALOG.modulePath, '../../scraper/healthifyme/script.js')
  assert.equal(HEALTHIFYME_CATALOG.dryRunFile, 'healthifyme/jobs.json')
  assert.equal(HEALTHIFYME_CATALOG.verifiedOn, '2026-07-16')
  assert.match(HEALTHIFYME_CATALOG.verifiedSurfaceSummary, /healthifyme\.com\/careers/i)
  assert.match(HEALTHIFYME_CATALOG.verifiedSurfaceSummary, /healthify\.darwinbox\.in/i)

  assert.equal(healthifyMe.PROVIDER_METADATA.source, HEALTHIFYME_CATALOG.source)
  assert.equal(healthifyMe.OFFICIAL_CAREERS_URL, HEALTHIFYME_CATALOG.companyCareerPage)
  assert.equal(
    healthifyMe.OFFICIAL_CAREERS_HANDOFF_URL,
    HEALTHIFYME_CATALOG.officialCareersHandoffUrl,
  )
  assert.equal(healthifyMe.DARWINBOX_ORIGIN, HEALTHIFYME_CATALOG.darwinboxOrigin)
})

test('HealthifyMe exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { HEALTHIFYME_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'HealthifyMe\n',
    catalog: [HEALTHIFYME_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HealthifyMe', 'healthifyme', 'HealthifyMe']],
  )
})

test('getScraperCatalog includes HealthifyMe as a verified Darwinbox provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'healthifyme')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HealthifyMe')
  assert.equal(provider.companyCareerPage, 'https://www.healthifyme.com/careers/')
  assert.equal(provider.companyDomain, 'healthifyme.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(provider.modulePath, /healthifyme[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HealthifyMe scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'healthifyme')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'healthifyme')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /healthifyme[\\/]jobs\.json$/i)
})
