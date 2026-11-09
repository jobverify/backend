import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Compuage as a verified first-party careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'compuage')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Compuage Infocom Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'http://www.compuageindia.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+inline-opening-cards+shared-apply-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'compuageindia.com')
  assert.match(provider.modulePath, /compuage[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Compuage rows via alias coverage', () => {
  const scraper = buildScrapers().find((item) => item.name === 'compuage')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /compuage[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'compuage')

  const report = generateCompanyCoverageReport({
    csvText: 'Compuage,\nCompuage Infocom Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Compuage', 'compuage', 'Compuage Infocom Ltd'],
      ['Compuage Infocom Ltd', 'compuage', 'Compuage Infocom Ltd'],
    ],
  )
})
