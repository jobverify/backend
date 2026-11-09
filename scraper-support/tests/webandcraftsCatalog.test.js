import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Webandcrafts is registered against the verified first-party jobs index without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'webandcrafts')

  assert.ok(provider, 'Expected Webandcrafts provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Webandcrafts')
  assert.equal(provider.companyCareerPage, 'https://webandcrafts.com/careers/job-openings')
  assert.equal(provider.atsPlatform, 'webandcrafts-first-party-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-native-flight-index+full-first-party-details+closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-careers-handoffs+active-literal-flight-listing+full-native-jobData+length-framed-literal-criteria+closing-model-reconciliation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'webandcrafts.com')
  assert.match(provider.modulePath, /webandcrafts[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Webandcrafts'), false)
})

test('Webandcrafts matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Webandcrafts,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Webandcrafts', 'webandcrafts', 'Webandcrafts']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'webandcrafts')

  assert.ok(scraper, 'Expected buildScrapers() to return the Webandcrafts scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'webandcrafts')
  assert.equal(scraper.provider.companyCareerPage, 'https://webandcrafts.com/careers/job-openings')
  assert.match(scraper.dryRunFile, /webandcrafts[\\/]jobs\.json$/i)
})
