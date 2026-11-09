import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Innovation Incubator is registered as an exact-name first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'innovationincubator')

  assert.ok(provider, 'Expected Innovation Incubator provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Innovation Incubator')
  assert.equal(provider.companyCareerPage, 'https://innovationincubator.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+html-job-cards+detail-pages+onsite-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'innovationincubator.com')
  assert.match(provider.modulePath, /innovationincubator[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Innovation Incubator'), false)
})

test('Innovation Incubator matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Innovation Incubator,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Innovation Incubator', 'innovationincubator', 'Innovation Incubator']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'innovationincubator')

  assert.ok(scraper, 'Expected buildScrapers() to return the Innovation Incubator scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'innovationincubator')
  assert.equal(scraper.provider.companyCareerPage, 'https://innovationincubator.com/careers/')
  assert.match(scraper.dryRunFile, /innovationincubator[\\/]jobs\.json$/i)
})
