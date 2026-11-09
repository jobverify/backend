import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Kampd is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kampd')

  assert.ok(provider, 'Expected Kampd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Kampd')
  assert.equal(provider.companyCareerPage, 'https://www.kampd.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-faq-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-faq-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kampd.com')
  assert.match(provider.modulePath, /kampd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Kampd'), false)
})

test('Kampd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Kampd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kampd', 'kampd', 'Kampd']],
  )
})

test('Kampd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kampd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Kampd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'kampd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.kampd.com/')
  assert.match(scraper.dryRunFile, /kampd[\\/]jobs\.json$/i)
})
