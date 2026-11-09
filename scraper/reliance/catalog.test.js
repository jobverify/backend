import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Reliance is registered against the official Reliance Industries careers portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'reliance')

  assert.ok(provider, 'Expected Reliance provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Reliance Industries Limited')
  assert.equal(provider.companyCareerPage, 'https://careers.ril.com/rilcareers/index.aspx')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'aspnet-postback-per-function')
  assert.equal(provider.extractionStrategy, 'official-ril-careers-search+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.ril.com')
  assert.match(provider.modulePath, /reliance[\\/]script\.js$/i)
  assert.equal(companyAliases.Reliance, 'reliance')
})

test('Reliance coverage uses one minimal alias to match both Reliance and Reliance group', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Reliance,\nReliance group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Reliance', 'reliance'],
    ['Reliance group', 'reliance'],
  ])
})

test('Reliance is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'reliance')

  assert.ok(scraper, 'Expected buildScrapers() to return the Reliance scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'reliance')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.ril.com/rilcareers/index.aspx')
  assert.match(scraper.dryRunFile, /reliance[\\/]jobs\.json$/i)
})
