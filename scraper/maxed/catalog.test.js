import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('MaxEd is registered with the verified first-party internship page and needs no alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'maxed')

  assert.ok(provider, 'Expected MaxEd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MaxEd')
  assert.equal(provider.companyCareerPage, 'https://maxed.in/internship/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-page-sitemap-plus-internship-page-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-page-sitemap+verified-public-internship-page+single-shared-google-form-apply-link+verified-missing-jobs-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'maxed.in')
  assert.match(provider.modulePath, /maxed[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MaxEd'), false)
})

test('MaxEd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'MaxEd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MaxEd', 'maxed', 'MaxEd']],
  )
})

test('MaxEd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'maxed')

  assert.ok(scraper, 'Expected buildScrapers() to return the MaxEd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'maxed')
  assert.equal(scraper.provider.companyCareerPage, 'https://maxed.in/internship/')
  assert.match(scraper.dryRunFile, /maxed[\\/]jobs\.json$/i)
})
