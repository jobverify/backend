import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/healthkart/catalog.js')
  } catch {
    assert.fail('Expected HealthKart catalog module at ../../scraper/healthkart/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/healthkart/script.js')
  } catch {
    assert.fail('Expected HealthKart scraper module at ../../scraper/healthkart/script.js')
  }
}

test('HealthKart local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { HEALTHKART_CATALOG } = await loadCatalogModule()
  const healthKart = await loadScriptModule()

  assert.equal(HEALTHKART_CATALOG.source, 'healthkart')
  assert.equal(HEALTHKART_CATALOG.companyName, 'HealthKart')
  assert.equal(HEALTHKART_CATALOG.officialBrandName, 'HealthKart')
  assert.equal(HEALTHKART_CATALOG.adapter, 'script')
  assert.equal(HEALTHKART_CATALOG.companyCareerPage, 'https://www.healthkart.com/careers')
  assert.equal(HEALTHKART_CATALOG.companyDomain, 'healthkart.com')
  assert.equal(HEALTHKART_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(HEALTHKART_CATALOG.countryFilter, 'India')
  assert.equal(
    HEALTHKART_CATALOG.paginationStrategy,
    'verified-careers-page-validation',
  )
  assert.equal(
    HEALTHKART_CATALOG.extractionStrategy,
    'verified-generic-careers-page-without-public-listings-return-empty',
  )
  assert.equal(HEALTHKART_CATALOG.parser, 'custom-script')
  assert.equal(HEALTHKART_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HEALTHKART_CATALOG.modulePath, '../../scraper/healthkart/script.js')
  assert.equal(HEALTHKART_CATALOG.dryRunFile, 'healthkart/jobs.json')
  assert.equal(HEALTHKART_CATALOG.verifiedOn, '2026-07-16')
  assert.match(HEALTHKART_CATALOG.verifiedSurfaceSummary, /healthkart\.com\/careers/i)
  assert.match(HEALTHKART_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(healthKart.PROVIDER_METADATA.source, HEALTHKART_CATALOG.source)
  assert.equal(healthKart.CAREERS_URL, HEALTHKART_CATALOG.companyCareerPage)
})

test('HealthKart exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { HEALTHKART_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'HealthKart\n',
    catalog: [HEALTHKART_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HealthKart', 'healthkart', 'HealthKart']],
  )
})

test('getScraperCatalog includes HealthKart as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'healthkart')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HealthKart')
  assert.equal(provider.companyCareerPage, 'https://www.healthkart.com/careers')
  assert.equal(provider.companyDomain, 'healthkart.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /healthkart[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HealthKart scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'healthkart')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'healthkart')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /healthkart[\\/]jobs\.json$/i)
})
