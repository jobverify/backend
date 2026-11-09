import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Providence as an official India RMK-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'providence')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Providence')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors-rmk')
  assert.equal(provider.companyCareerPage, 'https://www.providence.in/experienced-professionals/')
  assert.equal(provider.companyDomain, 'providence.in')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'declared-rmk-offset-links-all-pages-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'official-india-corporate-handoff+declared-providence-rmk-tenant+whole-own-jobposting-microdata+all-pages-and-details-opening-closing',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /providence[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Providence without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'providence')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /providence[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'providence')

  const report = generateCompanyCoverageReport({
    csvText: 'Providence,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Providence', 'providence', 'Providence']],
  )
})
