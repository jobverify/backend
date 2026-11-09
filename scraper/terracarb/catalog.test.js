import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Terracarb is registered against its verified first-party work-with-us surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'terracarb')

  assert.ok(provider, 'Expected Terracarb provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Terracarb')
  assert.equal(provider.companyCareerPage, 'https://terracarb.com/work-with-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-work-with-us-page-plus-sitemap-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-work-with-us-page+verified-sitemap+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'terracarb.com')
  assert.match(provider.modulePath, /terracarb[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Terracarb'), false)
})

test('Terracarb matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Terracarb,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Terracarb', 'terracarb', 'Terracarb']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'terracarb')

  assert.ok(scraper, 'Expected buildScrapers() to return the Terracarb scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'terracarb')
  assert.equal(scraper.provider.companyCareerPage, 'https://terracarb.com/work-with-us/')
  assert.match(scraper.dryRunFile, /terracarb[\\/]jobs\.json$/i)
})
