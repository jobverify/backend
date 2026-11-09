import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Bizongo as an current public-handoff provider with honest unavailable inventory', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bizongo')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Bizongo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'first-party-public-handoff')
  assert.equal(provider.companyCareerPage, 'https://bizongo.com/careers')
  assert.equal(provider.companyDomain, 'bizongo.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-public-hiring-handoff-with-unavailable-inventory-evidence')
  assert.equal(provider.extractionStrategy, 'active-corporate-handoff+strict-public-transport-failure+awaited-bounded-native-audit')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bizongo[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Bizongo without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bizongo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bizongo[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bizongo')

  const report = generateCompanyCoverageReport({
    csvText: 'Bizongo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
