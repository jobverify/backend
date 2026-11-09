import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Turso is registered as a fail-closed provider against the verified first-party legal and careers surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'turso')

  assert.ok(provider, 'Expected Turso provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Turso')
  assert.equal(provider.companyCareerPage, 'https://turso.tech/careers')
  assert.equal(provider.companyDomain, 'turso.tech')
  assert.equal(provider.termsOfUseUrl, 'https://turso.tech/terms-of-use')
  assert.equal(provider.publicAshbyBoardUrl, 'https://jobs.ashbyhq.com/turso')
  assert.equal(provider.publicLegalNameBoardUrl, 'https://jobs.ashbyhq.com/chiselstrike')
  assert.equal(provider.atsPlatform, 'no-trustworthy-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-legal-identity+careers-route-redirects-home+unconfigured-public-ashby-shells+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /turso[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /turso[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/turso\.tech\/terms-of-use/i)
  assert.match(provider.verifiedSurfaceSummary, /CHISELSTRIKE INC\./i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/turso\.tech\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /redirects to the homepage/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/turso\.tech\/careers\/senior-platform-engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /first-party 404/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/turso/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/chiselstrike/i)
})

test('Turso matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTurso\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Turso', 'turso', 'Turso']],
  )
})

test('Turso is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'turso')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'turso')
  assert.match(scraper.dryRunFile, /turso[\\/]jobs\.json$/i)
})
