import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Wafer Space is registered as a verified redirect-plus-parent-handoff non-listing sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'waferspace')

  assert.ok(provider, 'Expected Wafer Space provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Wafer Space')
  assert.equal(provider.companyCareerPage, 'https://waferspace.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-redirect-plus-missing-routes-plus-parent-careers-handoff-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-acl-redirect-target+verified-missing-first-party-routes+verified-generic-parent-careers-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'waferspace.com')
  assert.match(provider.modulePath, /waferspace[\\/]script\.js$/i)
})

test('Wafer Space matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Wafer Space\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Wafer Space', 'waferspace', 'Wafer Space']],
  )
})

test('Wafer Space is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'waferspace')

  assert.ok(scraper, 'Expected buildScrapers() to return the Wafer Space sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'waferspace')
  assert.equal(scraper.provider.companyCareerPage, 'https://waferspace.com/')
  assert.match(scraper.dryRunFile, /waferspace[\\/]jobs\.json$/i)
})
