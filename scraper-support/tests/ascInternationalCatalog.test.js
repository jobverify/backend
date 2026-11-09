import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ASC International as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ascinternational')

  assert.ok(provider)
  assert.equal(provider.companyName, 'ASC International')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://ascinternational.com/careers/')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.legacyJobPostingUrl, 'https://w2.ascinternational.com/job-posting/')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page-plus-legacy-first-party-timeout-validation')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page-html+dual-first-party-timeout-fallback-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ascinternational.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /Join Our Continuously Growing Team/i)
  assert.match(provider.verifiedSurfaceSummary, /timed out from the verified runtime environment/i)
  assert.match(provider.modulePath, /ascinternational[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve ASC International to the ascinternational source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ascinternational')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ascinternational[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'ascinternational')

  const report = generateCompanyCoverageReport({
    csvText: 'ASC International,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ASC International', 'ascinternational', 'ASC International']],
  )
})
