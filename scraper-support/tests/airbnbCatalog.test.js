import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/airbnb/catalog.js')
  } catch {
    assert.fail('Expected Airbnb catalog module at ../../scraper/airbnb/catalog.js')
  }
}

test('Airbnb catalog captures the verified first-party careers redirect and paginated positions archive metadata', async () => {
  const airbnbCatalog = await loadCatalogModule()

  assert.deepEqual(airbnbCatalog.AIRBNB_CATALOG, {
    source: 'airbnb',
    companyName: 'Airbnb',
    companyCareerPage: 'https://careers.airbnb.com/positions/',
    companyDomain: 'airbnb.com',
    adapter: 'script',
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'verified-careers-redirect-plus-first-party-wordpress-archive-pagination',
    extractionStrategy: 'verified-careers-home+verified-positions-archive+first-party-detail-urls+india-location-filter',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: 'scraper/airbnb/script.js',
    verifiedOn: '2026-07-15',
    verifiedSurfaceSummary: 'Verified on July 15, 2026 that https://www.airbnb.com/careers redirects to the official first-party careers site at https://careers.airbnb.com/, and the public positions archive at https://careers.airbnb.com/positions/ paginates first-party Airbnb job cards and detail URLs, including current India roles in Bangalore and Gurugram.',
    officialCareersEntryUrl: 'https://www.airbnb.com/careers',
    officialCareersHomeUrl: 'https://careers.airbnb.com/',
    positionsUrl: 'https://careers.airbnb.com/positions/',
  })
})

test('Airbnb backlog matching works directly from the local catalog metadata', async () => {
  const { AIRBNB_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Airbnb\n',
    catalog: [AIRBNB_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airbnb', 'airbnb', 'Airbnb']],
  )
})

test('buildScrapers and company coverage resolve Airbnb from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airbnb')
  const scraper = buildScrapers().find((item) => item.name === 'airbnb')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airbnb')
  assert.match(provider.companyCareerPage, /^https:\/\/careers\.airbnb\.com\/positions\//)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.match(scraper.dryRunFile, /airbnb[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airbnb\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airbnb', 'airbnb', 'Airbnb']],
  )
})
