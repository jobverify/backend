import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Teleperformance as an official India careers shell provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'teleperformance')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Teleperformance')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.tp.com/en-in/locations/india/careers/')
  assert.equal(provider.companyDomain, 'tp.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-india-location-handoff-plus-careers-shell')
  assert.equal(
    provider.extractionStrategy,
    'official-india-location-handoff+verified-india-careers-shell-zero-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /teleperformance[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the Teleperformance (BPO) backlog entry', () => {
  const scraper = buildScrapers().find((item) => item.name === 'teleperformance')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /teleperformance[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'teleperformance')

  const report = generateCompanyCoverageReport({
    csvText: 'Teleperformance (BPO),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Teleperformance (BPO)', 'teleperformance', 'Teleperformance']],
  )
})
