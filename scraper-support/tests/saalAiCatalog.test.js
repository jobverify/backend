import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Saal AI as an current own career-handoff script provider with unknown inventory', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'saalai')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Saal AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-current-native-career-handoff-inventory-unqualified')
  assert.equal(provider.companyCareerPage, 'https://www.saal.ai/en/company/')
  assert.equal(provider.companyDomain, 'saal.ai')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'own-home-robots-declared-sitemap-and-current-company-opening-closing')
  assert.equal(provider.extractionStrategy, 'whole-native-corporate-career-and-crawl-models+exact-unread-linkedin-handoff+country-criteria-application-and-company-inventory-unqualified')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /saalai[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Saal AI without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'saalai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /saalai[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'saalai')

  const report = generateCompanyCoverageReport({
    csvText: 'Saal AI,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Saal AI', 'saalai', 'Saal AI']],
  )
})
