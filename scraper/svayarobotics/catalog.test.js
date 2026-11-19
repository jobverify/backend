import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Svaya Robotics is registered against the verified first-party openings surface without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'svayarobotics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Svaya Robotics')
  assert.equal(provider.companyCareerPage, 'https://svayarobotics.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-own-homepage-careers-and-role-pages-with-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'verified-own-employer-homepage+native-careers-role-links+full-native-role-criteria+whole-declared-client-and-stylesheet-verification+native-candidate-form+closing-reconciliation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'svayarobotics.com')
  assert.match(provider.modulePath, /svayarobotics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Svaya Robotics'), false)
})

test('Svaya Robotics matches company coverage directly from provider metadata and stays runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Svaya Robotics\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Svaya Robotics', 'svayarobotics', 'Svaya Robotics']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'svayarobotics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'svayarobotics')
  assert.equal(scraper.provider.companyCareerPage, 'https://svayarobotics.com/careers/')
  assert.match(scraper.dryRunFile, /svayarobotics[\\/]jobs\.json$/i)
})
