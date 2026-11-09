import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Genex Space is registered against the current first-party discovery-only inventory', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'genexspace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Genex Space')
  assert.equal(provider.companyCareerPage, 'https://genex.space/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-current-client-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-company-and-join-us-bundle+no-public-listings-discovery-only-return-empty',
  )
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'genex.space')
  assert.match(provider.modulePath, /genexspace[\\/]script\.js$/i)
})

test('Genex Space matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Genex Space\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Genex Space', 'genexspace', 'Genex Space']],
  )
})

test('Genex Space is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'genexspace')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'genexspace')
  assert.equal(scraper.provider.companyCareerPage, 'https://genex.space/')
  assert.match(scraper.dryRunFile, /genexspace[\\/]jobs\.json$/i)
})
