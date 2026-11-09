import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Royal Enfield as a Phenom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'royalenfield')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Royal Enfield')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.royalenfield.com/us/en')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'embedded-json+detail-page')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.royalenfield.com')
  assert.match(provider.modulePath, /royalenfield[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Royal Enfield to the royalenfield source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'royalenfield')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /royalenfield[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'royalenfield')

  const report = generateCompanyCoverageReport({
    csvText: 'Royal Enfield,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Royal Enfield', 'royalenfield', 'Royal Enfield']],
  )
})
