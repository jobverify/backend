import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes MathWorks as an official RSS-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mathworks')

  assert.ok(provider)
  assert.equal(provider.companyName, 'MathWorks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.mathworks.com/company/jobs/opportunities.html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-rss-feed')
  assert.equal(provider.extractionStrategy, 'official-rss-feed+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mathworks.com')
  assert.match(provider.modulePath, /mathworks[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve MathWorks to the mathworks source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mathworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mathworks[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'mathworks')

  const report = generateCompanyCoverageReport({
    csvText: 'MathWorks,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MathWorks', 'mathworks', 'MathWorks']],
  )
})
