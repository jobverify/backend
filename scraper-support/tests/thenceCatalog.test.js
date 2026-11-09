import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Thence Private Limited as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'thence')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Thence Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://thence.digital/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-handoff-plus-single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-homepage-handoff+public-role-select-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'thence.digital')
  assert.match(provider.modulePath, /thence[\\/]script\.js$/i)
})

test('Thence coverage matches the exact backlog row without needing aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'thence')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /thence[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'thence')

  const report = generateCompanyCoverageReport({
    csvText: 'Thence Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Thence Private Limited', 'thence', 'Thence Private Limited']],
  )
})
