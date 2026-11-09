import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('BuyUcoin is registered in the provider catalog with the verified careers-page metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'buyucoin')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'BuyUcoin')
  assert.equal(provider.companyCareerPage, 'https://www.buyucoin.com/career')
  assert.equal(provider.homepageUrl, 'https://www.buyucoin.com/')
  assert.equal(provider.companyDomain, 'buyucoin.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-openings+external-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /Job Opportunities entries/i)
  assert.match(provider.modulePath, /buyucoin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /buyucoin[\\/]jobs\.json$/i)
})

test('BuyUcoin resolves through the shared catalog and coverage lookup without alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nBuyUcoin\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'buyucoin')

  const scraper = buildScrapers().find((item) => item.name === 'buyucoin')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'buyucoin')
  assert.match(scraper.dryRunFile, /buyucoin[\\/]jobs\.json$/i)
})
