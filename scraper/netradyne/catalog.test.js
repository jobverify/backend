import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Netradyne is registered with the verified first-party careers page and exact CSV alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'netradyne')

  assert.ok(provider, 'Expected Netradyne provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netradyne')
  assert.equal(provider.companyCareerPage, 'https://www.netradyne.com/company/careers')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-embedded-greenhouse-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+embedded-greenhouse-jobs-api+first-party-gh_jid-detail-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'netradyne.com')
  assert.match(provider.modulePath, /netradyne[\\/]script\.js$/i)
  assert.equal(companyAliases['netra dyne'], 'netradyne')
})

test('netra dyne matches company coverage through the explicit CSV alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'netra dyne,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['netra dyne', 'netradyne', 'Netradyne']],
  )
})

test('Netradyne is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'netradyne')

  assert.ok(scraper, 'Expected buildScrapers() to return the Netradyne scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'netradyne')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.netradyne.com/company/careers')
  assert.match(scraper.dryRunFile, /netradyne[\\/]jobs\.json$/i)
})
