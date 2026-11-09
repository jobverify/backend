import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('URC Construction is registered as a verified first-party resume-upload sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'urcconstruction')

  assert.ok(provider, 'Expected URC Construction provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'URC Construction')
  assert.equal(provider.companyCareerPage, 'https://www.urcindia.com/Career.aspx')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-form+verified-missing-employment-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'urcindia.com')
  assert.match(provider.modulePath, /urcconstruction[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'URC Construction'), false)
})

test('URC Construction resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'URC Construction,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['URC Construction', 'urcconstruction', 'URC Construction']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'urcconstruction')

  assert.ok(scraper, 'Expected buildScrapers() to return the URC Construction sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'urcconstruction')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.urcindia.com/Career.aspx')
  assert.match(scraper.dryRunFile, /urcconstruction[\\/]jobs\.json$/i)
})
