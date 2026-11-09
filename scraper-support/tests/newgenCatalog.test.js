import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Newgen Software as an OmniRecruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'newgen')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Newgen Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'omnirecruit')
  assert.equal(provider.companyCareerPage, 'https://newgensoft.com/in/company/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-jobs-portal-page')
  assert.equal(provider.extractionStrategy, 'official-jobs-portal+html-job-cards+registration-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'newgensoft.com')
  assert.match(provider.modulePath, /newgen[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Newgen Software to the newgen source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'newgen')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /newgen[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'newgen')

  const report = generateCompanyCoverageReport({
    csvText: 'Newgen Software,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Newgen Software', 'newgen', 'Newgen Software']],
  )
})
