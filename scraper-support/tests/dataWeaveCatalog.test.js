import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dataweave/catalog.js')
  } catch {
    assert.fail('Expected DataWeave catalog module at ../../scraper/dataweave/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/dataweave/script.js')
  } catch {
    assert.fail('Expected DataWeave scraper module at ../../scraper/dataweave/script.js')
  }
}

test('DataWeave local catalog captures the verified first-party careers page and inline-apply detail route', async () => {
  const { DATAWEAVE_CATALOG } = await loadCatalogModule()
  const dataWeave = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(DATAWEAVE_CATALOG)

  assert.equal(provider.source, 'dataweave')
  assert.equal(provider.companyName, 'DataWeave')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://dataweave.com/')
  assert.equal(provider.companyCareerPage, 'https://dataweave.com/us/careers')
  assert.equal(provider.sampleJobUrl, 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R')
  assert.equal(provider.companyDomain, 'dataweave.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+visible-current-openings-list+same-domain-detail-page+inline-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.dryRunFile, /dataweave[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /dataweave[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dataweave\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dataweave\.com\/us\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore/i)

  assert.equal(dataWeave.PROVIDER_METADATA.source, provider.source)
  assert.equal(dataWeave.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(dataWeave.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('DataWeave backlog row matches directly from local provider metadata', async () => {
  const { DATAWEAVE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DataWeave\n',
    catalog: [hydrateProviderCatalogEntry(DATAWEAVE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DataWeave', 'dataweave', 'DataWeave']],
  )
})

test('buildScrapers and company coverage resolve DataWeave from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dataweave')
  const scraper = buildScrapers().find((item) => item.name === 'dataweave')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'DataWeave')
  assert.equal(provider.companyCareerPage, 'https://dataweave.com/us/careers')
  assert.match(scraper.dryRunFile, /dataweave[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'DataWeave\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DataWeave', 'dataweave', 'DataWeave']],
  )
})
