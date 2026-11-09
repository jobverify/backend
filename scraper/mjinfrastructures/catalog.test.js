import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('M. J. Infrastructures is registered against its verified first-party no-public-careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mjinfrastructures')

  assert.ok(provider, 'Expected M. J. Infrastructures provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'M. J. Infrastructures')
  assert.equal(provider.companyCareerPage, 'https://mjinfrastructure.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-page-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-contact-page-legal-entity+commented-careers-trace+404-careers-check',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mjinfrastructure.com')
  assert.match(provider.modulePath, /mjinfrastructures[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'M. J. Infrastructures'), false)
})

test('company coverage resolves M. J. Infrastructures to its scraper without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'M. J. Infrastructures,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['M. J. Infrastructures', 'mjinfrastructures', 'M. J. Infrastructures']],
  )
})

test('M. J. Infrastructures is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mjinfrastructures')

  assert.ok(scraper, 'Expected buildScrapers() to return the M. J. Infrastructures scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mjinfrastructures')
  assert.equal(scraper.provider.companyCareerPage, 'https://mjinfrastructure.com/')
  assert.match(scraper.dryRunFile, /mjinfrastructures[\\/]jobs\.json$/i)
})
