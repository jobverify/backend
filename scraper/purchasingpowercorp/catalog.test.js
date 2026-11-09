import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Purchasing Power Corp is registered as a verified first-party zero-job sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'purchasingpowercorp')

  assert.ok(provider, 'Expected Purchasing Power Corp provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Purchasing Power Corp')
  assert.equal(provider.companyCareerPage, 'https://www.purchasingpower.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-robots-plus-sitemap-plus-route-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-missing-robots+verified-sitemap-without-careers+verified-common-careers-shells+verified-legacy-careers-redirect-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'purchasingpower.com')
  assert.match(provider.modulePath, /purchasingpowercorp[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Purchasing Power Corp'), false)
})

test('Purchasing Power Corp matches company coverage directly from provider metadata and is runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Purchasing Power Corp,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Purchasing Power Corp', 'purchasingpowercorp', 'Purchasing Power Corp']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'purchasingpowercorp')

  assert.ok(scraper, 'Expected buildScrapers() to return the Purchasing Power Corp scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'purchasingpowercorp')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.purchasingpower.com/')
  assert.match(scraper.dryRunFile, /purchasingpowercorp[\\/]jobs\.json$/i)
})
