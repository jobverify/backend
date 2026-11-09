import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Bharat Petroleum as an official careers page scraper with an IBPS apply handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatpetroleum')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Bharat Petroleum')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-ibps-handoff')
  assert.equal(provider.companyCareerPage, 'https://www.bharatpetroleum.in/careers/job-openings')
  assert.equal(provider.companyDomain, 'bharatpetroleum.in')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-job-openings-page')
  assert.equal(provider.extractionStrategy, 'official-job-openings-page+ibps-apply-links+deadline-filtering')
  assert.match(provider.modulePath, /bharatpetroleum[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Bharat Petroleum without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatpetroleum')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bharatpetroleum[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bharatpetroleum')

  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Petroleum,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
