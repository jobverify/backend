import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Increff as a Zoho Recruit script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'increff')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Increff')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.companyCareerPage, 'https://www.increff.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-json-feed')
  assert.equal(provider.extractionStrategy, 'official-careers-page+zoho-public-jobs-api+public-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'increff.com')
  assert.match(provider.modulePath, /increff[\\/]script\.js$/i)
  assert.equal(companyAliases.Increff, 'increff')
})

test('buildScrapers and company coverage resolve Increff to the increff source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'increff')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /increff[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'increff')

  const report = generateCompanyCoverageReport({
    csvText: 'Increff,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Increff', 'increff', 'Increff']],
  )
})
