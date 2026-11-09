import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Trane Technologies as a Phenom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tranetechnologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Trane Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.tranetechnologies.com/global/en/home')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'embedded-json+detail-page')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.tranetechnologies.com')
  assert.match(provider.modulePath, /tranetechnologies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Trane Technologies to the tranetechnologies source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tranetechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tranetechnologies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tranetechnologies')

  const report = generateCompanyCoverageReport({
    csvText: 'Trane Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Trane Technologies', 'tranetechnologies', 'Trane Technologies']],
  )
})
