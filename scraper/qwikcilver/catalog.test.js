import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Qwikcilver is registered as a verified parent-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'qwikcilver')

  assert.ok(provider, 'Expected Qwikcilver provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Qwikcilver')
  assert.equal(provider.companyCareerPage, 'https://www.pinelabs.com/careers')
  assert.equal(provider.atsPlatform, 'official-parent-company-careers-no-brand-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-parent-company-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-parent-company-careers-page+no-qwikcilver-brand-signal+no-public-job-board-signal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pinelabs.com')
  assert.match(provider.modulePath, /qwikcilver[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Qwikcilver'), false)
})

test('Qwikcilver matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Qwikcilver,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Qwikcilver', 'qwikcilver', 'Qwikcilver']],
  )
})

test('Qwikcilver is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'qwikcilver')

  assert.ok(scraper, 'Expected buildScrapers() to return the Qwikcilver scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'qwikcilver')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.pinelabs.com/careers')
  assert.match(scraper.dryRunFile, /qwikcilver[\\/]jobs\.json$/i)
})
