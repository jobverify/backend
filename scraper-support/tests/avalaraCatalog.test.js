import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Avalara as an official public Jibe careers API source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avalara')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims-jibe')
  assert.equal(provider.companyName, 'Avalara')
  assert.equal(provider.companyCareerPage, 'https://careers.avalara.com/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'icims-jibe-public-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.avalara.com')
  assert.match(provider.modulePath, /avalara[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Avalara to avalara', () => {
  const scraper = buildScrapers().find((item) => item.name === 'avalara')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'avalara')
  assert.match(scraper.dryRunFile, /avalara[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Avalara,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Avalara', 'avalara', 'avalara']],
  )
})
