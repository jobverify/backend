import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Royal Atlas is registered as a verified first-party email-only careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'royalatlas')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Royal Atlas')
  assert.equal(provider.companyCareerPage, 'https://royal-atlas.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'United Arab Emirates')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-and-contact-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-email-only-careers-page+verified-contact-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'royal-atlas.com')
  assert.match(provider.modulePath, /royalatlas[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Royal Atlas'), false)
})

test('Royal Atlas resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Royal Atlas\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Royal Atlas', 'royalatlas', 'Royal Atlas']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'royalatlas')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'royalatlas')
  assert.equal(scraper.provider.companyCareerPage, 'https://royal-atlas.com/careers/')
  assert.match(scraper.dryRunFile, /royalatlas[\\/]jobs\.json$/i)
})
