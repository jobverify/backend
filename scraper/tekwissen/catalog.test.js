import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('TekWissen Software Pvt Ltd is registered as a CEIPAL widget scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tekwissen')

  assert.ok(provider, 'Expected TekWissen provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TekWissen Software Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://tekwissen.com/career/india/')
  assert.equal(provider.atsPlatform, 'ceipal-widget')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-landing-plus-india-ceipal-widget')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage+careers-landing+india-careers-ceipal-widget',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tekwissen.com')
  assert.match(provider.modulePath, /tekwissen[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TekWissen Software Pvt Ltd'), false)
})

test('TekWissen resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'TekWissen Software Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TekWissen Software Pvt Ltd', 'tekwissen', 'TekWissen Software Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'tekwissen')

  assert.ok(scraper, 'Expected buildScrapers() to return the TekWissen scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tekwissen')
  assert.equal(scraper.provider.companyCareerPage, 'https://tekwissen.com/career/india/')
  assert.match(scraper.dryRunFile, /tekwissen[\\/]jobs\.json$/i)
})
