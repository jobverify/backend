import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mu Sigma as a LinkedIn guest-search script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'musigma')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mu Sigma')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://www.mu-sigma.com/career/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-company-search-page')
  assert.equal(provider.extractionStrategy, 'official-careers-linkedin-handoff+guest-search+public-detail-jsonld')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mu-sigma.com')
  assert.match(provider.modulePath, /musigma[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Mu Sigma to the musigma source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'musigma')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /musigma[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'musigma')

  const report = generateCompanyCoverageReport({
    csvText: 'Mu Sigma,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mu Sigma', 'musigma', 'Mu Sigma']],
  )
})
