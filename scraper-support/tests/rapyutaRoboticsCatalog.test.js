import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Rapyuta Robotics on the verified official careers page backed by the Workable widget feed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rapyutarobotics')

  assert.ok(provider, 'Expected Rapyuta Robotics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rapyuta Robotics')
  assert.equal(provider.companyCareerPage, 'https://www.rapyuta-robotics.com/careers/')
  assert.equal(provider.atsPlatform, 'workable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-single-widget-account-feed')
  assert.equal(provider.extractionStrategy, 'official-careers-page+embedded-workable-widget-api+india-location-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rapyuta-robotics.com')
  assert.match(provider.modulePath, /rapyutarobotics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rapyuta Robotics'), false)
})

test('Rapyuta Robotics matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Rapyuta Robotics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Rapyuta Robotics', 'rapyutarobotics'],
  ])
})

test('buildScrapers exposes a runnable Rapyuta Robotics scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rapyutarobotics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Rapyuta Robotics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'rapyutarobotics')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.rapyuta-robotics.com/careers/')
  assert.match(scraper.dryRunFile, /rapyutarobotics[\\/]jobs\.json$/i)
})
