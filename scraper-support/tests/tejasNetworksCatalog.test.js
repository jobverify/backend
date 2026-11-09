import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tejas Networks as an Oracle Cloud script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tejasnetworks')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tejas Networks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'oracle-cloud-finder-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iablcp.fa.ocs.oraclecloud.com')
  assert.match(provider.modulePath, /tejasnetworks[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Tejas Networks to the tejasnetworks source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tejasnetworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tejasnetworks[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tejasnetworks')

  const report = generateCompanyCoverageReport({
    csvText: 'Tejas Networks,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tejas Networks', 'tejasnetworks', 'Tejas Networks']],
  )
})
