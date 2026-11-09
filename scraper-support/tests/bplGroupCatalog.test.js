import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BPL Group as a no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bplgroup')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BPL Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.bpl.in/')
  assert.equal(provider.companyDomain, 'bpl.in')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-not-found-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-not-found-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bplgroup[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BPL Group without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bplgroup')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bplgroup[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bplgroup')

  const report = generateCompanyCoverageReport({
    csvText: 'BPL Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
