import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../../scraper-support/providers/index.js'

test('getScraperCatalog includes NTT Data Services as a verified Phenom script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nttdataservices')

  assert.ok(provider)
  assert.equal(provider.companyName, 'NTT Data Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.nttdata.com/global/en/search-results',
  )
  assert.equal(provider.companyDomain, 'careers.nttdata.com')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-handoff-plus-complete-phenom-widget-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-nttdata-homepage-handoff+verified-nttdata-careers-handoff+country-filtered-phenom-widget+bounded-detail-enrichment',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /nttdataservices[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact NTT Data Services backlog entry', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nttdataservices')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nttdataservices')
  assert.equal(scraper.provider.companyName, 'NTT Data Services')
  assert.match(scraper.dryRunFile, /nttdataservices[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'NTT Data Services,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NTT Data Services', 'nttdataservices', 'NTT Data Services']],
  )
})
