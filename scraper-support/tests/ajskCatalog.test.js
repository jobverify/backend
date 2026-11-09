import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/ajsk/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected AJSK provider contract at ../../scraper/ajsk/provider.json')
  }
}

test('AJSK provider contract captures the verified first-party no-public-careers surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'ajsk')
  assert.equal(provider.companyName, 'AJSK')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ajsk.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-wordpress-pages-api-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-wordpress-pages-api+missing-careers-routes+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ajsk.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ajsk\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /wp-json\/wp\/v2\/pages\?per_page=100/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /AJSK GmbH/i)
  assert.match(provider.modulePath, /ajsk[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ajsk[\\/]jobs\.json$/i)
})

test('AJSK provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'AJSK\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AJSK', 'ajsk', 'AJSK']],
  )
})

test('buildScrapers and company coverage resolve AJSK from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ajsk')
  const scraper = buildScrapers().find((item) => item.name === 'ajsk')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AJSK')
  assert.equal(provider.companyCareerPage, 'https://www.ajsk.com/')
  assert.match(scraper.dryRunFile, /ajsk[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AJSK\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AJSK', 'ajsk', 'AJSK']],
  )
})
