import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Ansys as a verified first-party handoff to Synopsys search jobs', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ansys')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ansys')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.ansys.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-handoff-plus-synopsys-search-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+synopsys-search-results')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ansys.com')
  assert.match(provider.modulePath, /ansys[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Ansys and Ansys India to the ansys source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ansys')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ansys[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'ansys')

  const report = generateCompanyCoverageReport({
    csvText: 'Ansys,\nAnsys India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Ansys', 'ansys', 'Ansys'],
      ['Ansys India', 'ansys', 'Ansys'],
    ],
  )
})
