import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('RISC-V International is registered as a fail-closed exact-name provider against the verified nonprofit surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'riscvinternational')

  assert.ok(provider)
  assert.equal(provider.companyName, 'RISC-V International')
  assert.equal(provider.homepageUrl, 'https://riscv.org/about/')
  assert.equal(provider.companyCareerPage, 'https://riscv.org/community/jobs/')
  assert.equal(provider.communityJobsBoardUrl, 'https://riscv.org/community/jobs/')
  assert.equal(provider.companyDomain, 'riscv.org')
  assert.equal(provider.atsPlatform, 'nonprofit-standards-body-community-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-nonprofit-about-page+verified-community-jobs-board-not-exact-employer+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /riscvinternational[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /riscvinternational[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /global non-profit home/i)
  assert.match(provider.verifiedSurfaceSummary, /does not maintain any commercial interest/i)
  assert.match(provider.verifiedSurfaceSummary, /Search for available careers working in RISC-V/i)
  assert.match(provider.verifiedSurfaceSummary, /returns no jobs/i)
})

test('RISC-V International resolves directly from exact-name provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nRISC-V International\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RISC-V International', 'riscvinternational', 'RISC-V International']],
  )
})

test('RISC-V International is runnable through the central scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'riscvinternational')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'riscvinternational')
  assert.match(scraper.dryRunFile, /riscvinternational[\\/]jobs\.json$/i)
})
