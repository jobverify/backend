import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('VA Tech Wabag is registered as a first-party script provider with current-opportunities metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wabag')

  assert.ok(provider, 'Expected VA Tech Wabag provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'VA Tech Wabag')
  assert.equal(provider.companyCareerPage, 'https://www.wabag.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'verified-first-party-current-opportunities-plus-same-domain-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'wabag.com')
  assert.match(provider.modulePath, /wabag[\\/]script\.js$/i)
})

test('VA Tech Wabag resolves through coverage matching and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'VA Tech Wabag,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['VA Tech Wabag', 'wabag', 'VA Tech Wabag']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wabag')

  assert.ok(scraper, 'Expected buildScrapers() to return the VA Tech Wabag scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wabag')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.wabag.com/careers/')
  assert.match(scraper.dryRunFile, /wabag[\\/]jobs\.json$/i)
})
