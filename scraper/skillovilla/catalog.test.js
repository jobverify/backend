import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SkilloVilla is registered against its verified official site', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'skillovilla')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SkilloVilla')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.skillovilla.com/')
  assert.equal(provider.companyDomain, 'skillovilla.com')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-routes')
  assert.equal(provider.extractionStrategy, 'official-site+404-careers-check')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /skillovilla[\\/]script\.js$/i)
})

test('SkilloVilla is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'skillovilla')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'skillovilla')
  assert.match(scraper.dryRunFile, /skillovilla[\\/]jobs\.json$/i)
})

test('company coverage resolves SkilloVilla to its scraper without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,SkilloVilla\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['SkilloVilla', 'skillovilla']],
  )
})
