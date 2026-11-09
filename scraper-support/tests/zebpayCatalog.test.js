import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('ZebPay is registered in the provider catalog with verified zero-openings metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zebpay')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ZebPay')
  assert.equal(provider.companyCareerPage, 'https://zebpay.com/careers')
  assert.equal(provider.officialSiteUrl, 'https://zebpay.com/')
  assert.equal(provider.companyDomain, 'zebpay.com')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-page')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page-zero-openings-state')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+zero-openings-message+fail-closed-on-public-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /we don'?t have any openings currently/i)
  assert.match(provider.modulePath, /zebpay[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /zebpay[\\/]jobs\.json$/i)
})

test('ZebPay resolves through the shared catalog and company coverage without alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nZebPay\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'zebpay')

  const scraper = buildScrapers().find((item) => item.name === 'zebpay')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'zebpay')
  assert.match(scraper.dryRunFile, /zebpay[\\/]jobs\.json$/i)
})
