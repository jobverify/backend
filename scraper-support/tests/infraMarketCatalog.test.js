import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Infra.Market as a PeopleStrong script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'inframarket')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Infra.Market')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.companyCareerPage, 'https://infra.market/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-limit-api')
  assert.equal(provider.extractionStrategy, 'peoplestrong-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'infra.market')
  assert.match(provider.modulePath, /inframarket[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Infra.Market without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'inframarket')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /inframarket[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'inframarket')

  const report = generateCompanyCoverageReport({
    csvText: 'Infra.Market,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Infra.Market', 'inframarket', 'Infra.Market']],
  )
})
