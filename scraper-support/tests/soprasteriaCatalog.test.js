import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sopra Steria as an Attrax script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'soprasteria')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Sopra Steria')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'attrax')
  assert.equal(provider.companyCareerPage, 'https://careers.soprasteria.in/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'attrax-html-cards+detail-page-workflow-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.soprasteria.in')
  assert.match(provider.modulePath, /soprasteria[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Sopra Steria to the soprasteria source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'soprasteria')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /soprasteria[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'soprasteria')

  const report = generateCompanyCoverageReport({
    csvText: 'Sopra Steria,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sopra Steria', 'soprasteria', 'Sopra Steria']],
  )
})
