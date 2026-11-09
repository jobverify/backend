import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes igus India as an official careers script provider with narrow aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'igusindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'igus India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.igus.in/company/career')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-listing-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'official-careers-page+html-job-cards+detail-pages+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'igus.in')
  assert.match(provider.modulePath, /igusindia[\\/]script\.js$/i)
  assert.equal(companyAliases['igus India'], 'igusindia')
  assert.equal(companyAliases.igus, 'igusindia')
})

test('buildScrapers and company coverage resolve igus India to the igusindia source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'igusindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /igusindia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'igusindia')

  const report = generateCompanyCoverageReport({
    csvText: 'igus India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['igus India', 'igusindia', 'igus India']],
  )
})
