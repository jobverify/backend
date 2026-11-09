import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('COSGrid Networks is registered against its verified first-party openings page without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cosgridnetworks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'COSGrid Networks')
  assert.equal(provider.companyCareerPage, 'https://www.cosgrid.com/company/careers/openings')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-plus-openings-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-careers-landing+verified-openings-cards+detail-page-validation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cosgrid.com')
  assert.match(provider.modulePath, /cosgridnetworks[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'COSGrid Networks'), false)
})

test('COSGrid Networks matches the CSV row directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'COSGrid Networks,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['COSGrid Networks', 'cosgridnetworks', 'COSGrid Networks']],
  )
})

test('COSGrid Networks is runnable through the provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cosgridnetworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cosgridnetworks')
  assert.match(scraper.dryRunFile, /cosgridnetworks[\\/]jobs\.json$/i)
})
