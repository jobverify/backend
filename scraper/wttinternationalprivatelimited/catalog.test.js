import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('WTT International Private Limited is registered as an unreachable-or-unresolved first-party sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wttinternationalprivatelimited')

  assert.ok(provider, 'Expected WTT International Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'WTT International Private Limited')
  assert.equal(provider.companyCareerPage, 'https://wttinternational.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-unreachable-or-parked-routes-plus-unresolved-domain-validation')
  assert.equal(provider.extractionStrategy, 'verified-first-party-connect-timeouts-or-parked-routes+verified-unresolved-first-party-domains-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'wttinternational.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /connect-timeout/i)
  assert.match(provider.verifiedSurfaceSummary, /authoritative empty result/i)
  assert.match(provider.modulePath, /wttinternationalprivatelimited[\\/]script\.js$/i)
})

test('WTT International Private Limited matches company coverage and builds through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'WTT International Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WTT International Private Limited', 'wttinternationalprivatelimited', 'WTT International Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wttinternationalprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the WTT International Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wttinternationalprivatelimited')
  assert.equal(scraper.provider.companyName, 'WTT International Private Limited')
  assert.match(scraper.dryRunFile, /wttinternationalprivatelimited[\\/]jobs\.json$/i)
})
