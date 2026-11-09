import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Blinkit as a verified zero-openings first-party jobs shell', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'blinkit')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-jobs-page')
  assert.equal(provider.companyName, 'Blinkit')
  assert.equal(provider.companyCareerPage, 'https://blinkit.com/careers/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-zero-openings-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-zero-openings-shell-or-dual-cloudflare-blocked-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'blinkit.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /access-denied page/i)
  assert.match(provider.modulePath, /blinkit[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Blinkit to blinkit', () => {
  const scraper = buildScrapers().find((item) => item.name === 'blinkit')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'blinkit')
  assert.match(scraper.dryRunFile, /blinkit[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Blinkit,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Blinkit', 'blinkit', 'blinkit']],
  )
})
