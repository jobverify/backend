import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Fanplay as an official careers scraper backed by WP Job Openings', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'fanplay')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Fanplay')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.companyCareerPage, 'https://fanplayiot.com/?page_id=834')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'fanplayiot.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /fanplay[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Fanplay to the fanplay source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'fanplay')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /fanplay[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'fanplay')

  const report = generateCompanyCoverageReport({
    csvText: 'Fanplay,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fanplay', 'fanplay', 'Fanplay']],
  )
})
