import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('IQnext (Synconext) is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iqnextsynconext')

  assert.ok(provider, 'Expected IQnext (Synconext) provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IQnext (Synconext)')
  assert.equal(provider.companyCareerPage, 'https://www.iqnext.io/careers')
  assert.equal(provider.atsPlatform, 'official-careers-page-wellfound-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-handoff-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-iqnext-homepage+verified-careers-wellfound-handoff+verified-readable-wellfound-board-listing-extraction',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iqnext.io')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedIndiaJobCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /View 1 job/i)
  assert.match(provider.verifiedSurfaceSummary, /Enterprise Sales Manager \(B2B, SaaS\)/i)
  assert.match(provider.modulePath, /iqnextsynconext[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'IQnext (Synconext)'), false)
})

test('IQnext (Synconext) matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'IQnext (Synconext),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IQnext (Synconext)', 'iqnextsynconext', 'IQnext (Synconext)']],
  )
})

test('IQnext (Synconext) is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iqnextsynconext')

  assert.ok(scraper, 'Expected buildScrapers() to return the IQnext (Synconext) scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iqnextsynconext')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.iqnext.io/careers')
  assert.match(scraper.dryRunFile, /iqnextsynconext[\\/]jobs\.json$/i)
})
