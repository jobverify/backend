import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Reliance Retail is registered as a verified first-party zero-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'relianceretail')

  assert.ok(provider, 'Expected Reliance Retail provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Reliance Retail')
  assert.equal(provider.companyCareerPage, 'https://www.relianceretail.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-shared-404-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-shared-first-party-404-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'relianceretail.com')
  assert.match(provider.modulePath, /relianceretail[\\/]script\.js$/i)
})

test('Reliance Retail resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Reliance Retail,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Reliance Retail', 'relianceretail', 'Reliance Retail']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'relianceretail')

  assert.ok(scraper, 'Expected buildScrapers() to return the Reliance Retail sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'relianceretail')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.relianceretail.com/')
  assert.match(scraper.dryRunFile, /relianceretail[\\/]jobs\.json$/i)
})

test('generateCompanyCoverageReport resolves Ajio to the Reliance Retail provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ajio,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ajio', 'relianceretail', 'Reliance Retail']],
  )
})
