import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes StoreKing as a fail-closed script provider on the current official surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'storeking')

  assert.ok(provider)
  assert.equal(provider.companyName, 'StoreKing')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://storeking.in/contact')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'about-contact-and-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-about-page-careers-contact-handoff+verified-contact-page-job-seeker-form+missing-public-careers-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'storeking.in')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.modulePath, /storeking[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve StoreKing to the storeking source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'storeking')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /storeking[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'storeking')

  const report = generateCompanyCoverageReport({
    csvText: 'StoreKing,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['StoreKing', 'storeking', 'StoreKing']],
  )
})
