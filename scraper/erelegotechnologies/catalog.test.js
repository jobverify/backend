import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('eReleGo Technologies is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'erelegotechnologies')

  assert.ok(provider, 'Expected eReleGo Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'eReleGo Technologies')
  assert.equal(provider.companyCareerPage, 'https://erelego.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-redirect-and-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-email-only-careers-page+verified-careers-alias-redirects+verified-missing-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'erelego.com')
  assert.match(provider.modulePath, /erelegotechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'eReleGo Technologies'), false)
})

test('eReleGo Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'eReleGo Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['eReleGo Technologies', 'erelegotechnologies', 'eReleGo Technologies']],
  )
})

test('eReleGo Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'erelegotechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the eReleGo Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'erelegotechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://erelego.com/career/')
  assert.match(scraper.dryRunFile, /erelegotechnologies[\\/]jobs\.json$/i)
})
