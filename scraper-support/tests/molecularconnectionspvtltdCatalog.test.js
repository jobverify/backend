import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Molecular Connections Pvt Ltd as an official careers scraper with verified metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'molecularconnectionspvtltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Molecular Connections Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://career.molecularconnections.com/technology-job-openings/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-role-listings-page')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage-handoff+official-careers-hub+static-technology-role-triplets+same-domain-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'career.molecularconnections.com')
  assert.match(provider.modulePath, /molecularconnectionspvtltd[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact Molecular Connections Pvt Ltd CSV name without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'molecularconnectionspvtltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /molecularconnectionspvtltd[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'molecularconnectionspvtltd')

  const report = generateCompanyCoverageReport({
    csvText: 'Molecular Connections Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Molecular Connections Pvt Ltd', 'molecularconnectionspvtltd', 'Molecular Connections Pvt Ltd']],
  )
})
