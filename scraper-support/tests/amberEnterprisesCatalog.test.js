import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog preserves the current exact Amber native handoff without verified vacancy totals', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amberenterprises')

  assert.ok(provider, 'Expected Amber Enterprises provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Amber Enterprises')
  assert.equal(provider.companyCareerPage, 'https://www.ambergroupindia.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-corporate-careers+exact-declared-employer-native-handoff;stop-on-denial')
  assert.equal(
    provider.extractionStrategy,
    'exact-current-employer-handoff-binding+native-HTTP-status;unknown-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ambergroupindia.com')
  assert.match(provider.modulePath, /amberenterprises[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amber Enterprises'), false)
})

test('Amber Enterprises is runnable through the provider catalog and matches coverage without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'amberenterprises')

  assert.ok(scraper, 'Expected buildScrapers() to return the Amber Enterprises scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'amberenterprises')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ambergroupindia.com/careers/')
  assert.match(scraper.dryRunFile, /amberenterprises[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amber Enterprises,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amber Enterprises', 'amberenterprises', 'Amber Enterprises']],
  )
})
