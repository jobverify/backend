import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bristol Myers Squibb as an exact-name Eightfold apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bristolmyerssquibb')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'Bristol Myers Squibb')
  assert.equal(provider.companyCareerPage, 'https://jobs.bms.com/careers?location=india')
  assert.equal(provider.companyDomain, 'jobs.bms.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-limit')
  assert.equal(provider.extractionStrategy, 'api+detail')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://jobs.bms.com/api/pcsx/search')
  assert.equal(provider.config.request.query.domain, 'bms.com')
  assert.equal(provider.config.request.query.location, 'India')
  assert.equal(
    provider.config.detail.urlTemplate,
    'https://jobs.bms.com/api/pcsx/position_details?position_id={{jobId}}&domain=bms.com&hl=en',
  )
  assert.equal(
    provider.config.request.headers.Referer,
    'https://jobs.bms.com/careers?domain=bms.com',
  )
  assert.equal(provider.config.request.headers.Origin, 'https://jobs.bms.com')
  assert.match(
    provider.config.resultFilter.include[0].pattern,
    /india|hyderabad|mumbai|delhi|bangalore|bengaluru|pune|chennai|gurgaon|gurugram|remote/i,
  )
})

test('buildScrapers and company coverage resolve Bristol Myers Squibb to a runnable exact-name source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bristolmyerssquibb')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bristolmyerssquibb[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bristolmyerssquibb')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')

  const report = generateCompanyCoverageReport({
    csvText: 'Bristol Myers Squibb\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bristol Myers Squibb', 'bristolmyerssquibb', 'Bristol Myers Squibb']],
  )
})
