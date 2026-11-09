import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('UB Group is registered against the verified first-party HEINEKEN careers handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ubgroup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'United Breweries Limited')
  assert.equal(provider.companyCareerPage, 'https://www.unitedbreweries.com/careers')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-heineken-listing-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-heineken-handoff+listing-page+detail-pages+successfactors-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'unitedbreweries.com')
  assert.match(provider.modulePath, /ubgroup[\\/]script\.js$/i)
  assert.equal(companyAliases['UB Group'], 'ubgroup')
})

test('UB Group resolves through the explicit backlog alias and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'UB Group\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['UB Group', 'ubgroup', 'United Breweries Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ubgroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ubgroup')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.unitedbreweries.com/careers')
  assert.match(scraper.dryRunFile, /ubgroup[\\/]jobs\.json$/i)
})
