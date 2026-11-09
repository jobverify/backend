import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('ShopUp is registered as an explicit empty-board first-party careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'shopup')

  assert.ok(provider, 'Expected ShopUp provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ShopUp')
  assert.equal(provider.companyCareerPage, 'https://shopup.org/career')
  assert.equal(provider.atsPlatform, 'official-company-careers-empty-board')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'homepage-plus-explicit-empty-careers-page-validation')
  assert.equal(provider.extractionStrategy, 'verified-official-homepage-plus-careers-page-explicit-no-open-positions')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'shopup.org')
  assert.match(provider.modulePath, /shopup[\\/]script\.js$/i)
})

test('ShopUp resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ShopUp,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ShopUp', 'shopup', 'ShopUp']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'shopup')

  assert.ok(scraper, 'Expected buildScrapers() to return the ShopUp scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'shopup')
  assert.equal(scraper.provider.companyName, 'ShopUp')
  assert.match(scraper.dryRunFile, /shopup[\\/]jobs\.json$/i)
})
