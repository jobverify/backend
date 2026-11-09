import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BigHaat as a verified official careers page with no public listings', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bighaat')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BigHaat')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://corporate.bighaat.com/careers/')
  assert.equal(provider.companyDomain, 'corporate.bighaat.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-page-plus-no-public-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /bighaat[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BigHaat without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bighaat')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bighaat[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bighaat')

  const report = generateCompanyCoverageReport({
    csvText: 'BigHaat,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
