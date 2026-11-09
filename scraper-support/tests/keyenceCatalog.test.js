import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Keyence is registered against the verified official apply-only careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'keyence')

  assert.ok(provider, 'Expected Keyence provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Keyence')
  assert.equal(provider.companyCareerPage, 'https://www.keyence.co.in/ss/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-page+shared-office-form-apply-only-zero-jobs')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'keyence.co.in')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Verified on Friday, August 7, 2026/i)
  assert.match(provider.modulePath, /keyence[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Keyence'), false)
})

test('Keyence matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Keyence,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Keyence', 'keyence'],
  ])
})

test('Keyence is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'keyence')

  assert.ok(scraper, 'Expected buildScrapers() to return the Keyence scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'keyence')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.keyence.co.in/ss/career/')
  assert.match(scraper.dryRunFile, /keyence[\\/]jobs\.json$/i)
})
