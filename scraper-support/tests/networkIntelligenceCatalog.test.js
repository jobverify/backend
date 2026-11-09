import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Network Intelligence with official page plus WP feed metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'networkintelligence')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Network Intelligence')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.networkintelligence.ai/career/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-wp-json-feed')
  assert.equal(provider.extractionStrategy, 'official-careers-page+wp-json-feed+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'networkintelligence.ai')
  assert.match(provider.modulePath, /networkintelligence[\\/]script\.js$/i)
  assert.equal(companyAliases['NII Consulting'], 'networkintelligence')
  assert.equal(companyAliases['Network Intelligence India'], 'networkintelligence')
})

test('buildScrapers and company coverage resolve Network Intelligence to the networkintelligence source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'networkintelligence')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /networkintelligence[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'networkintelligence')

  const report = generateCompanyCoverageReport({
    csvText: 'Network Intelligence,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Network Intelligence', 'networkintelligence', 'Network Intelligence']],
  )
})
