import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mowito as a verified careers-contact zero-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mowito')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mowito')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://www.mowito.ai/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-homepage')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-contact-surface+no-public-job-board',
  )
  assert.equal(provider.companyDomain, 'mowito.ai')
  assert.match(provider.modulePath, /mowito[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact CSV company name Mowito', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mowito')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mowito')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /mowito[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Mowito,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mowito', 'mowito', 'Mowito']],
  )
})
