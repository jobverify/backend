import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes TAC Security as an official careers-page script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tacsecurity')

  assert.ok(provider)
  assert.equal(provider.companyName, 'TAC Security')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://tacsecurity.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+html-open-position-headings+india-location-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tacsecurity.com')
  assert.match(provider.modulePath, /tacsecurity[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve TAC Security without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tacsecurity')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tacsecurity[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tacsecurity')

  const report = generateCompanyCoverageReport({
    csvText: 'TAC Security,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TAC Security', 'tacsecurity', 'TAC Security']],
  )
})
