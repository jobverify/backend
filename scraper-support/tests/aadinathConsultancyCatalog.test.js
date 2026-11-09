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
    return (await import('../../scraper/aadinathconsultancy/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected Aadinath Consultancy provider contract at ../../scraper/aadinathconsultancy/provider.json')
  }
}

test('Aadinath Consultancy provider contract captures the verified no-public-careers first-party surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'aadinathconsultancy')
  assert.equal(provider.companyName, 'Aadinath Consultancy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://aadinathconsultants.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-first-party-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-timeout-only-first-party-routes+legacy-autoindex-homepage-and-missing-first-party-careers-routes+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aadinathconsultants.com')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /repeated connect timeouts/i)
  assert.match(provider.modulePath, /aadinathconsultancy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /aadinathconsultancy[\\/]jobs\.json$/i)
})

test('Aadinath Consultancy provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'Aadinath Consultancy\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aadinath Consultancy', 'aadinathconsultancy', 'Aadinath Consultancy']],
  )
})

test('buildScrapers and company coverage resolve Aadinath Consultancy from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aadinathconsultancy')
  const scraper = buildScrapers().find((item) => item.name === 'aadinathconsultancy')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aadinath Consultancy')
  assert.equal(provider.companyCareerPage, 'https://aadinathconsultants.com/')
  assert.match(scraper.dryRunFile, /aadinathconsultancy[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aadinath Consultancy\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aadinath Consultancy', 'aadinathconsultancy', 'Aadinath Consultancy']],
  )
})
