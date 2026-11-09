import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

test('getScraperCatalog includes Ignitarium as a verified official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ignitarium')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ignitarium')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://ignitarium.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'ignitarium.com')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-redirect+inline-job-cards+detail-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /ignitarium[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Ignitarium without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ignitarium')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ignitarium[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'ignitarium')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Ignitarium\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Ignitarium', 'ignitarium', 'ignitarium']],
  )
  assert.equal(report.unmatchedCount, 0)
})
