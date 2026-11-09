import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AppDynamics as a Cisco Careers Phenom wrapper with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'appdynamics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'AppDynamics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://www.appdynamics.com/company/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'phenom-search-page+detail-page')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'appdynamics.com')
  assert.match(provider.modulePath, /appdynamics[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve AppDynamics to the appdynamics source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'appdynamics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /appdynamics[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'appdynamics')

  const report = generateCompanyCoverageReport({
    csvText: 'AppDynamics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AppDynamics', 'appdynamics', 'AppDynamics']],
  )
})
