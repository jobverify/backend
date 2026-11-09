import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Bright Money on the verified official openings page and public Kula API', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'brightmoney')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Bright Money')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'kula-public-api')
  assert.equal(provider.companyCareerPage, 'https://www.brightmoney.co/openings')
  assert.equal(provider.companyDomain, 'brightmoney.co')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-openings-page-plus-inline-kula-api-contract')
  assert.equal(
    provider.extractionStrategy,
    'official-openings-page+inline-kula-public-token+kula-job-board-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /brightmoney[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Bright Money without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'brightmoney')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /brightmoney[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'brightmoney')

  const report = generateCompanyCoverageReport({
    csvText: 'Bright Money,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bright Money', 'brightmoney', 'Bright Money']],
  )
})
