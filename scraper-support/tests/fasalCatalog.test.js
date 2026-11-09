import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Fasal as a verified first-party Zoho careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'fasal')

  assert.ok(provider, 'Expected Fasal provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Fasal')
  assert.equal(provider.companyCareerPage, 'https://www.fasal.co/life-at-fasal')
  assert.equal(provider.companyDomain, 'fasal.co')
  assert.equal(provider.officialCareersHandoffUrl, 'https://jobs.fasal.co/jobs/Careers')
  assert.equal(
    provider.careersApiUrl,
    'https://jobs.fasal.co/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-board-api-full-array-and-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-employer-handoff+exact-Wolkus-Fasal-native-organization+full-record-descriptions',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.modulePath, /fasal[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Fasal careers page/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\.fasal\.co/i)
  assert.match(provider.verifiedSurfaceSummary, /Board\/API inventories/i)
  assert.match(provider.verifiedSurfaceSummary, /closing snapshot/i)
})

test('generateCompanyCoverageReport resolves the exact backlog row Fasal without alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Fasal\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fasal', 'fasal', 'Fasal']],
  )
})

test('buildScrapers exposes a runnable Fasal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'fasal')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'fasal')
  assert.equal(scraper.provider.atsPlatform, 'zohorecruit')
  assert.match(scraper.dryRunFile, /fasal[\\/]jobs\.json$/i)
})
