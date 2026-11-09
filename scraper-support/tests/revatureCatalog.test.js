import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Revature on the verified official homepage handoff backed by the public Workday tenant', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'revature')

  assert.ok(provider, 'Expected Revature provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Revature')
  assert.equal(provider.companyCareerPage, 'https://www.revature.com/')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'jobs-api')
  assert.equal(provider.extractionStrategy, 'official-homepage-handoff+workday-jobs-api+workday-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'revature.com')
  assert.match(provider.modulePath, /revature\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Revature scraper and exact CSV coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'revature')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'revature')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /revature.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Revature,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Revature', 'revature', 'Revature']],
  )
})
