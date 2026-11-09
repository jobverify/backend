import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mindteck as an official careers shell script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mindteck')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mindteck')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.mindteck.com/')
  assert.equal(provider.companyDomain, 'careers.mindteck.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-job-search-shell')
  assert.equal(provider.extractionStrategy, 'official-homepage-handoff+official-careers-handoff+zero-jobs-shell')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /mindteck[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact Mindteck CSV backlog entry without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mindteck')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mindteck[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'mindteck')

  const report = generateCompanyCoverageReport({
    csvText: 'Mindteck,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mindteck', 'mindteck', 'Mindteck']],
  )
})
