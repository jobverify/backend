import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Hano Software Solutions is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hanosoftwaresolutions')

  assert.ok(provider, 'Expected Hano Software Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hano Software Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.hanosoftwaresolutions.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-routes-plus-client-bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-shell+verified-common-careers-shells+verified-client-bundle-without-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hanosoftwaresolutions.com')
  assert.match(provider.modulePath, /hanosoftwaresolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hano Software Solutions'), false)
})

test('Hano Software Solutions matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Hano Software Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hano Software Solutions', 'hanosoftwaresolutions', 'Hano Software Solutions']],
  )
})

test('Hano Software Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hanosoftwaresolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Hano Software Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hanosoftwaresolutions')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.hanosoftwaresolutions.com/')
  assert.match(scraper.dryRunFile, /hanosoftwaresolutions[\\/]jobs\.json$/i)
})
