import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Textron as an official Jobsyn-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'textron')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Textron')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'jobsyn-solr')
  assert.equal(provider.companyCareerPage, 'https://careers.textron.com/locations/ind/jobs/')
  assert.equal(provider.companyDomain, 'careers.textron.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-number')
  assert.equal(provider.extractionStrategy, 'jobsyn-search-api+derived-public-detail-url')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /textron[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Textron to the textron source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'textron')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /textron[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'textron')

  const report = generateCompanyCoverageReport({
    csvText: 'Textron,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Textron', 'textron', 'Textron']],
  )
})
