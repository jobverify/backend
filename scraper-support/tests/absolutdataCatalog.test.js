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
    return (await import('../../scraper/absolutdata/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Absolutdata provider contract at ../../scraper/absolutdata/provider.json')
  }
}

test('Absolutdata provider contract captures the verified timeout-only first-party surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'absolutdata')
  assert.equal(provider.companyName, 'Absolutdata')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://absolutdata.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-domain-root-plus-common-careers-route-timeout-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-first-party-domains-time-out-plus-common-careers-routes-time-out-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'absolutdata.com')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /timed out during direct probes/i)
  assert.match(provider.modulePath, /absolutdata[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /absolutdata[\\/]jobs\.json$/i)
})

test('Absolutdata provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'Absolutdata\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Absolutdata', 'absolutdata', 'Absolutdata']],
  )
})

test('buildScrapers and company coverage resolve Absolutdata from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'absolutdata')
  const scraper = buildScrapers().find((item) => item.name === 'absolutdata')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Absolutdata')
  assert.equal(provider.companyCareerPage, 'https://absolutdata.com/')
  assert.match(scraper.dryRunFile, /absolutdata[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Absolutdata\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Absolutdata', 'absolutdata', 'Absolutdata']],
  )
})
