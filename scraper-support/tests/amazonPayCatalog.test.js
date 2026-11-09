import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAmazonPayCatalog = async () => {
  try {
    return await import('../../scraper/amazonpay/catalog.js')
  } catch {
    assert.fail('Expected Amazon Pay catalog module at ../../scraper/amazonpay/catalog.js')
  }
}

test('Amazon Pay provider metadata captures the verified first-party Amazon Jobs search surface without aliases', async () => {
  const { AMAZON_PAY_CATALOG } = await loadAmazonPayCatalog()
  const provider = hydrateProviderCatalogEntry(AMAZON_PAY_CATALOG)

  assert.equal(provider.source, 'amazonpay')
  assert.equal(provider.companyName, 'Amazon Pay')
  assert.equal(provider.officialBrandName, 'Amazon Pay')
  assert.equal(provider.adapter, 'script')
  assert.equal(
    provider.companyCareerPage,
    'https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    provider.searchApiUrl,
    'https://www.amazon.jobs/en/search.json?offset=0&result_limit=10&sort=relevant&base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'amazon-jobs-search-json-offset')
  assert.equal(
    provider.extractionStrategy,
    'verified-amazon-jobs-search-page+amazon-jobs-search-json+amazon-pay-signal-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'amazon.jobs')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /amazonpay[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /amazon\.jobs\/en\/search\?base_query=Amazon%20Pay/i)
  assert.match(provider.verifiedSurfaceSummary, /amazon\.jobs\/en\/search\.json/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst, Amazon Pay/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amazon Pay'), false)
})

test('Amazon Pay backlog row matches directly from provider metadata without alias churn', async () => {
  const { AMAZON_PAY_CATALOG } = await loadAmazonPayCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Amazon Pay\n',
    catalog: [hydrateProviderCatalogEntry(AMAZON_PAY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amazon Pay', 'amazonpay', 'Amazon Pay']],
  )
})

test('buildScrapers and company coverage resolve Amazon Pay from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amazonpay')
  const scraper = buildScrapers().find((item) => item.name === 'amazonpay')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amazon Pay')
  assert.equal(
    provider.companyCareerPage,
    'https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.match(scraper.dryRunFile, /amazonpay[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amazon Pay\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amazon Pay', 'amazonpay', 'Amazon Pay']],
  )
})
