import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Litmus7 is registered as a verified zero-job first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'litmus7')

  assert.ok(provider, 'Expected Litmus7 provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Litmus7 Systems Consulting Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.litmus7.com/Career')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+no-open-positions-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'litmus7.com')
  assert.match(provider.modulePath, /litmus7[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Litmus7 Systems Consulting Ltd'), false)
})

test('Litmus7 exact-company CSV rows resolve directly through provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Litmus7 Systems Consulting Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Litmus7 Systems Consulting Ltd', 'litmus7', 'Litmus7 Systems Consulting Ltd']],
  )
})

test('Litmus7 is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'litmus7')

  assert.ok(scraper, 'Expected buildScrapers() to return the Litmus7 scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'litmus7')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.litmus7.com/Career')
  assert.match(scraper.dryRunFile, /litmus7[\\/]jobs\.json$/i)
})
