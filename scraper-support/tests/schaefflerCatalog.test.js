import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Schaeffler on the official India search route with Vitesco aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'schaeffler')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Schaeffler')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(
    provider.companyCareerPage,
    'https://jobs.schaeffler.com/search/?createNewAlert=false&q=&locationsearch=India&locale=en_US',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query-pagination')
  assert.equal(provider.extractionStrategy, 'official-india-search+detail-pages+apply-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.schaeffler.com')
  assert.match(provider.modulePath, /schaeffler[\\/]script\.js$/i)
  assert.equal(companyAliases['Vitesco Technologies'], 'schaeffler')
  assert.equal(companyAliases['Vitesco Technologies Group AG'], 'schaeffler')
})

test('buildScrapers and company coverage resolve Vitesco Technologies to the Schaeffler source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'schaeffler')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /schaeffler[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'schaeffler')

  const report = generateCompanyCoverageReport({
    csvText: 'Vitesco Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Vitesco Technologies', 'schaeffler', 'Schaeffler']],
  )
})
