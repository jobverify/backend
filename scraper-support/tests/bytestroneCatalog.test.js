import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Bytestrone is registered against the verified first-party public jobs surface without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bytestrone')

  assert.ok(provider, 'Expected Bytestrone provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Bytestrone')
  assert.equal(provider.companyCareerPage, 'https://bytestrone.com/en/position/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-position-page-with-embedded-json-and-detail-pages')
  assert.equal(provider.extractionStrategy, 'verified-position-page+embedded-openings-data+same-domain-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bytestrone.com')
  assert.match(provider.modulePath, /bytestrone[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bytestrone'), false)
})

test('Bytestrone matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Bytestrone,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bytestrone', 'bytestrone', 'Bytestrone']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'bytestrone')

  assert.ok(scraper, 'Expected buildScrapers() to return the Bytestrone scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bytestrone')
  assert.equal(scraper.provider.companyCareerPage, 'https://bytestrone.com/en/position/')
  assert.match(scraper.dryRunFile, /bytestrone[\\/]jobs\.json$/i)
})
