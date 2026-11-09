import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BloomReach on the official careers page backed by Greenhouse', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bloomreach')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BloomReach')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://www.bloomreach.com/en/careers')
  assert.equal(provider.companyDomain, 'bloomreach.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-linked-greenhouse-board')
  assert.equal(provider.extractionStrategy, 'official-careers-page+linked-greenhouse-board+greenhouse-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bloomreach[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BloomReach without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bloomreach')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bloomreach[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bloomreach')

  const report = generateCompanyCoverageReport({
    csvText: 'BloomReach,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
