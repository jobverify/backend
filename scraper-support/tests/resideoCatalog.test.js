import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Resideo as an Oracle Cloud script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'resideo')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Resideo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://ehtl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'oracle-cloud-finder-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ehtl.fa.us6.oraclecloud.com')
  assert.match(provider.modulePath, /resideo[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Resideo to the resideo source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'resideo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /resideo[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'resideo')

  const report = generateCompanyCoverageReport({
    csvText: 'Resideo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Resideo', 'resideo', 'Resideo']],
  )
})
