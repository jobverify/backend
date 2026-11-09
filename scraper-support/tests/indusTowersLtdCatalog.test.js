import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Indus Towers Ltd is registered on the verified official careers page without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'industowersltd')

  assert.ok(provider, 'Expected Indus Towers Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Indus Towers Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.industowers.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'industowers.com')
  assert.match(provider.modulePath, /industowersltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Indus Towers Ltd'), false)
})

test('Indus Towers Ltd matches backlog coverage directly from provider metadata and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Indus Towers Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Indus Towers Ltd', 'industowersltd', 'Indus Towers Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'industowersltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Indus Towers Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'industowersltd')
  assert.match(scraper.dryRunFile, /industowersltd[\\/]jobs\.json$/i)
})
