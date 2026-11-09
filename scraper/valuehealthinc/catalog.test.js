import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Value Health Inc. is registered as a first-party parked-domain sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'valuehealthinc')

  assert.ok(provider, 'Expected Value Health Inc. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Value Health Inc.')
  assert.equal(provider.companyCareerPage, 'https://valuehealth.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'redirect-shell-plus-parked-lander-plus-sitemap-validation')
  assert.equal(provider.extractionStrategy, 'verified-redirect-shell+verified-parked-lander+verified-sitemap+verified-missing-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'valuehealth.com')
  assert.match(provider.modulePath, /valuehealthinc[\\/]script\.js$/i)
})

test('Value Health Inc. matches company coverage and builds through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Value Health Inc.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Value Health Inc.', 'valuehealthinc', 'Value Health Inc.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'valuehealthinc')

  assert.ok(scraper, 'Expected buildScrapers() to return the Value Health Inc. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'valuehealthinc')
  assert.equal(scraper.provider.companyName, 'Value Health Inc.')
  assert.match(scraper.dryRunFile, /valuehealthinc[\\/]jobs\.json$/i)
})
