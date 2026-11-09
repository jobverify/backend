import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('EnGenius Matrix is registered against the verified first-party careers API surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'engeniusmatrix')

  assert.ok(provider, 'Expected EnGenius Matrix provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'EnGenius Matrix')
  assert.equal(provider.companyCareerPage, 'https://www.engeniusmatrix.com/careers/')
  assert.equal(provider.atsPlatform, 'wordpress-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-careers-page-plus-wordpress-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+official-wordpress-job-posts-api+same-page-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'engeniusmatrix.com')
  assert.match(provider.modulePath, /engeniusmatrix[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'EnGenius Matrix'), false)
})

test('EnGenius Matrix matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'EnGenius Matrix,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['EnGenius Matrix', 'engeniusmatrix', 'EnGenius Matrix']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'engeniusmatrix')

  assert.ok(scraper, 'Expected buildScrapers() to return the EnGenius Matrix scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'engeniusmatrix')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.engeniusmatrix.com/careers/')
  assert.match(scraper.dryRunFile, /engeniusmatrix[\\/]jobs\.json$/i)
})
