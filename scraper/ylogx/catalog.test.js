import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('YlogX is registered as an official-site empty-sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ylogx')

  assert.ok(provider)
  assert.equal(provider.companyName, 'YlogX')
  assert.equal(provider.companyCareerPage, 'https://ylogx.io/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'ylogx.io')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /ylogx[\\/]script\.js$/i)
})

test('Ylogx resolves directly through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ylogx,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ylogx', 'ylogx', 'YlogX']],
  )
})

test('YlogX remains runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ylogx')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ylogx[\\/]jobs\.json$/i)
})
