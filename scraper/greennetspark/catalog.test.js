import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('GreenNetSpark is registered as a first-party client-side careers provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'greennetspark')

  assert.ok(provider, 'Expected GreenNetSpark provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GreenNetSpark')
  assert.equal(provider.companyCareerPage, 'https://greennetspark.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-client-side-careers-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-main-bundle-careers-route+verified-careers-chunk+inline-job-cards+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'greennetspark.in')
  assert.match(provider.modulePath, /greennetspark[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GreenNetSpark'), false)
})

test('GreenNetSpark resolves from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'GreenNetSpark,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GreenNetSpark', 'greennetspark', 'GreenNetSpark']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'greennetspark')

  assert.ok(scraper, 'Expected buildScrapers() to return the GreenNetSpark scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'greennetspark')
  assert.equal(scraper.provider.companyCareerPage, 'https://greennetspark.in/careers')
  assert.match(scraper.dryRunFile, /greennetspark[\\/]jobs\.json$/i)
})
