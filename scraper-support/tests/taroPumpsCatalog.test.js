import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Taro Pumps is registered against the verified official careers page and singular backlog alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'taropumps')

  assert.ok(provider, 'Expected Taro Pumps provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Taro Pumps')
  assert.equal(provider.companyCareerPage, 'https://www.taropumps.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+first-party-group-detail-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'taropumps.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 4)
  assert.equal(provider.verifiedIndiaJobCount, 4)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 503/i)
  assert.match(provider.verifiedSurfaceSummary, /texmo\.com\/careers/i)
  assert.match(provider.modulePath, /taropumps[\\/]script\.js$/i)
  assert.equal(companyAliases['Taro Pump'], 'taropumps')
})

test('Taro Pump coverage resolves both the exact backlog row and the official plural brand', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Taro Pump,\nTaro Pumps,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Taro Pump', 'taropumps'],
    ['Taro Pumps', 'taropumps'],
  ])
})

test('Taro Pumps is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'taropumps')

  assert.ok(scraper, 'Expected buildScrapers() to return the Taro Pumps scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'taropumps')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.taropumps.com/careers')
  assert.match(scraper.dryRunFile, /taropumps[\\/]jobs\.json$/i)
})
