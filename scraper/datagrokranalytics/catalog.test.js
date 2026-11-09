import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Datagrokr Analytics is registered as a verified unresolved-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datagrokranalytics')

  assert.ok(provider, 'Expected Datagrokr Analytics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Datagrokr Analytics')
  assert.equal(provider.companyCareerPage, 'https://datagrokr.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-404-plus-candidate-domain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unrelated-homepage-surface+verified-careers-404-routes+verified-unresolved-candidate-first-party-domains-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'datagrokr.com')
  assert.match(provider.modulePath, /datagrokranalytics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Datagrokr Analytics'), false)
})

test('Datagrokr Analytics matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Datagrokr Analytics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Datagrokr Analytics', 'datagrokranalytics', 'Datagrokr Analytics']],
  )
})

test('Datagrokr Analytics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datagrokranalytics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Datagrokr Analytics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'datagrokranalytics')
  assert.equal(scraper.provider.companyCareerPage, 'https://datagrokr.com/')
  assert.match(scraper.dryRunFile, /datagrokranalytics[\\/]jobs\.json$/i)
})
