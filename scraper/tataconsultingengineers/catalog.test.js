import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'

test('getScraperCatalog includes Tata Consulting Engineers as an official SuccessFactors scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tataconsultingengineers')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tata Consulting Engineers Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://www.tataconsultingengineers.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query')
  assert.equal(provider.extractionStrategy, 'successfactors-search-page+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tataconsultingengineers.com')
  assert.match(provider.modulePath, /tataconsultingengineers[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Tata Consulting Engineers without a new alias', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tataconsultingengineers')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tataconsultingengineers[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tataconsultingengineers')

  const report = generateCompanyCoverageReport({
    csvText: 'Tata Consulting Engineers,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tata Consulting Engineers', 'tataconsultingengineers', 'Tata Consulting Engineers Limited']],
  )
})
