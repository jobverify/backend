import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes JP Morgan as an Oracle Cloud script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jpmorgan')

  assert.ok(provider)
  assert.equal(provider.companyName, 'JP Morgan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'oracle-cloud-finder-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jpmc.fa.oraclecloud.com')
  assert.match(provider.modulePath, /jpmorgan[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve JP Morgan to the jpmorgan source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jpmorgan')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /jpmorgan[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'jpmorgan')

  const report = generateCompanyCoverageReport({
    csvText: 'JP Morgan,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JP Morgan', 'jpmorgan', 'JP Morgan']],
  )
})
