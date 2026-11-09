import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Zepto is registered as a verified first-party blocked-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zepto')

  assert.ok(provider, 'Expected Zepto provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Zepto')
  assert.equal(provider.companyCareerPage, 'https://www.zepto.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-third-party-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-route-and-trailing-slash-alias-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-route-third-party-handoff+verified-trailing-slash-alias-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'zepto.com')
  assert.match(provider.modulePath, /zepto[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Zepto'), false)
})

test('Zepto resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Zepto,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Zepto', 'zepto', 'Zepto']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'zepto')

  assert.ok(scraper, 'Expected buildScrapers() to return the Zepto sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'zepto')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.zepto.com/careers')
  assert.match(scraper.dryRunFile, /zepto[\\/]jobs\.json$/i)
})
