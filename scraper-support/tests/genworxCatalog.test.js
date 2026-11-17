import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes the employer-declared Genworx native Zoho collector with bounded scope', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'genworx')

  assert.ok(provider, 'Expected Genworx provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Genworx')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://genworx.ai/')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-listing-detail-and-public-form-models-with-opening-closing-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage+declared-primary-module+zoho-native-roles+own-details-and-public-form-models',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'genworx.ai')
  assert.match(provider.modulePath, /genworx[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Genworx'), false)
})

test('buildScrapers and company coverage resolve Genworx without a new alias', () => {
  const scraper = buildScrapers().find((item) => item.name === 'genworx')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'genworx')
  assert.match(scraper.dryRunFile, /genworx[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Genworx,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Genworx', 'genworx', 'Genworx']],
  )
})
