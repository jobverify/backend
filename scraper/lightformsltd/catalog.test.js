import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Light Forms Ltd is registered against its verified first-party no-public-careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lightformsltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Light Forms Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.lightforms.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-page-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-contact-page-work-with-us-form+404-careers-check',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lightforms.com')
  assert.match(provider.modulePath, /lightformsltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Light Forms Ltd'), false)
})

test('Light Forms Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lightformsltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lightformsltd')
  assert.match(scraper.dryRunFile, /lightformsltd[\\/]jobs\.json$/i)
})

test('company coverage resolves Light Forms Ltd to its scraper without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Light Forms Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Light Forms Ltd', 'lightformsltd']],
  )
})
