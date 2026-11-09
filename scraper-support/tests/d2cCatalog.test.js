import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadProviderContract = async () => {
  try {
    return (await import('../../scraper/d2c/provider.json', { with: { type: 'json' } })).default
  } catch {
    assert.fail('Expected D2C provider contract at ../../scraper/d2c/provider.json')
  }
}

test('D2C provider contract captures the verified no-public-careers first-party surface', async () => {
  const providerContract = await loadProviderContract()
  const provider = hydrateProviderCatalogEntry(providerContract)

  assert.equal(provider.source, 'd2c')
  assert.equal(provider.companyName, 'D2C')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://d2c.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-first-party-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-missing-first-party-careers-routes+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'd2c.in')
  assert.match(provider.modulePath, /d2c[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /d2c[\\/]jobs\.json$/i)
})

test('D2C provider contract hydrates into company coverage matching', async () => {
  const providerContract = await loadProviderContract()
  const report = generateCompanyCoverageReport({
    csvText: 'D2C\n',
    catalog: [hydrateProviderCatalogEntry(providerContract)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['D2C', 'd2c', 'D2C']],
  )
})

test('buildScrapers and company coverage resolve D2C from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'd2c')
  const scraper = buildScrapers().find((item) => item.name === 'd2c')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'D2C')
  assert.equal(provider.companyCareerPage, 'https://d2c.in/')
  assert.match(scraper.dryRunFile, /d2c[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'D2C\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['D2C', 'd2c', 'D2C']],
  )
})
