import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Doppio as a first-party vacancies-feed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'doppio')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Doppio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-open-application-intake')
  assert.equal(provider.companyCareerPage, 'https://www.doppio-espresso.nl/werken-bij-doppio/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'company-declared-careers+intake-stop+inventory-unverified')
  assert.equal(
    provider.extractionStrategy,
    'native-recruitment-post-observations+current-intake-evidence+no-inferred-role-country-or-requisition',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'doppio-espresso.nl')
  assert.match(provider.modulePath, /doppio[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Doppio to the doppio source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'doppio')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /doppio[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'doppio')

  const report = generateCompanyCoverageReport({
    csvText: 'Doppio,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Doppio', 'doppio', 'Doppio']],
  )
})
