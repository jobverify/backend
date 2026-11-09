import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Morrisons Lifecare Pvt. Ltd. is registered against its official first-party careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'morrisonslifecare')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Morrisons Lifecare Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.morrisonslifecare.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-page-listing-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'first-party-careers-cards+same-domain-detail-pages+shared-first-party-apply-form',
  )
  assert.equal(provider.companyDomain, 'morrisonslifecare.com')
  assert.match(provider.modulePath, /morrisonslifecare[\\/]script\.js$/i)
})

test('company coverage resolves the Morrisons Lifecare CSV row to the morrisonslifecare lane', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n815,Morrisons Lifecare Pvt. Ltd.\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.row, item.companyName, item.source]),
    [['815', 'Morrisons Lifecare Pvt. Ltd.', 'morrisonslifecare']],
  )
})

test('buildScrapers exposes a runnable Morrisons Lifecare scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'morrisonslifecare')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'morrisonslifecare')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /morrisonslifecare[\\/]jobs\.json$/i)
})
