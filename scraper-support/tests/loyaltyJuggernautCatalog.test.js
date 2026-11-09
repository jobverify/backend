import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Loyalty Juggernaut is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'loyaltyjuggernaut')

  assert.ok(provider, 'Expected Loyalty Juggernaut provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Loyalty Juggernaut')
  assert.equal(provider.companyCareerPage, 'https://www.lji.io/about-us')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-page-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-about-page+verified-common-careers-routes-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lji.io')
  assert.match(provider.modulePath, /loyaltyjuggernaut[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Loyalty Juggernaut'), false)
})

test('Loyalty Juggernaut matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Loyalty Juggernaut,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Loyalty Juggernaut',
      'loyaltyjuggernaut',
      'Loyalty Juggernaut',
    ]],
  )
})

test('Loyalty Juggernaut is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'loyaltyjuggernaut')

  assert.ok(scraper, 'Expected buildScrapers() to return the Loyalty Juggernaut scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'loyaltyjuggernaut')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.lji.io/about-us')
  assert.match(scraper.dryRunFile, /loyaltyjuggernaut[\\/]jobs\.json$/i)
})
