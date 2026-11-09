import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('PrepInsta is registered against the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prepinsta')

  assert.ok(provider, 'Expected PrepInsta provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PrepInsta')
  assert.equal(provider.companyCareerPage, 'https://prepinsta.com/career-opportunities/')
  assert.equal(provider.atsPlatform, 'wellfound-company-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-wellfound-handoff-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-angel-handoff+verified-wellfound-empty-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'prepinsta.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /View 0 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /PrepInsta hasn't added any jobs yet/i)
  assert.match(provider.modulePath, /prepinsta[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Prepinsta'), false)
})

test('Prepinsta matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Prepinsta,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Prepinsta', 'prepinsta', 'PrepInsta']],
  )
})

test('PrepInsta is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'prepinsta')

  assert.ok(scraper, 'Expected buildScrapers() to return the PrepInsta scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prepinsta')
  assert.equal(scraper.provider.companyCareerPage, 'https://prepinsta.com/career-opportunities/')
  assert.match(scraper.dryRunFile, /prepinsta[\\/]jobs\.json$/i)
})
