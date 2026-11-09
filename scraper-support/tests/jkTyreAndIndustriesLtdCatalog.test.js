import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('JK Tyre and Industries Ltd is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jktyreandindustriesltd')

  assert.ok(provider, 'Expected JK Tyre and Industries Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'JK Tyre and Industries Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.jktyre.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-career-page-plus-current-openings-empty-state')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-landing+verified-current-openings-empty-state-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jktyre.com')
  assert.match(provider.modulePath, /jktyreandindustriesltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'JK Tyre and Industries Ltd'), false)
})

test('JK Tyre and Industries Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'JK Tyre and Industries Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JK Tyre and Industries Ltd', 'jktyreandindustriesltd', 'JK Tyre and Industries Ltd']],
  )
})

test('JK Tyre and Industries Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jktyreandindustriesltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the JK Tyre and Industries Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jktyreandindustriesltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.jktyre.com/career')
  assert.match(scraper.dryRunFile, /jktyreandindustriesltd[\\/]jobs\.json$/i)
})
