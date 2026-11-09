import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Perfint Healthcare is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'perfinthealthcare')

  assert.ok(provider, 'Expected Perfint Healthcare provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Perfint Healthcare')
  assert.equal(provider.companyCareerPage, 'https://www.perfinthealthcare.com/careers.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-php-plus-common-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-email-only-careers-page+verified-fraud-warning+verified-missing-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'perfinthealthcare.com')
  assert.match(provider.modulePath, /perfinthealthcare[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Perfint Healthcare'), false)
})

test('Perfint Healthcare matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Perfint Healthcare,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Perfint Healthcare', 'perfinthealthcare', 'Perfint Healthcare']],
  )
})

test('Perfint Healthcare is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'perfinthealthcare')

  assert.ok(scraper, 'Expected buildScrapers() to return the Perfint Healthcare scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'perfinthealthcare')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.perfinthealthcare.com/careers.php')
  assert.match(scraper.dryRunFile, /perfinthealthcare[\\/]jobs\.json$/i)
})
