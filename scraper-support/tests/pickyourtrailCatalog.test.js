import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Pickyourtrail as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pickyourtrail')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Pickyourtrail')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://pickyourtrail.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+public-job-cards+shared-email-apply-route',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'pickyourtrail.com')
  assert.match(provider.modulePath, /pickyourtrail[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Pickyourtrail without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pickyourtrail')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /pickyourtrail[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'pickyourtrail')

  const report = generateCompanyCoverageReport({
    csvText: 'Pickyourtrail,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pickyourtrail', 'pickyourtrail', 'Pickyourtrail']],
  )
})
