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
    return (await import('../../scraper/aatral/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Aatral provider contract at ../../scraper/aatral/provider.json')
  }
}

test('Aatral provider contract captures the verified first-party careers surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'aatral')
  assert.equal(provider.companyName, 'Aatral')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://aatral.io/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-listings-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-listings-page+verified-first-party-opportunity-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aatral.io')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /public first-party careers surface/i)
  assert.match(provider.modulePath, /aatral[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /aatral[\\/]jobs\.json$/i)
})

test('Aatral provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'Aatral\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aatral', 'aatral', 'Aatral']],
  )
})

test('buildScrapers and company coverage resolve Aatral from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aatral')
  const scraper = buildScrapers().find((item) => item.name === 'aatral')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aatral')
  assert.equal(provider.companyCareerPage, 'https://aatral.io/careers/')
  assert.match(scraper.dryRunFile, /aatral[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aatral\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aatral', 'aatral', 'Aatral']],
  )
})
