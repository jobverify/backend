import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Omega Healthcare Management Services as a verified Oracle Cloud provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'omegahealthcaremanagementservices')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Omega Healthcare Management Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://www.omegahms.com/careers-india/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-careers-pages-plus-location-filtered-oracle-cloud-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'omegahms.com')
  assert.match(provider.modulePath, /omegahealthcaremanagementservices[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Omega Healthcare Management Services to the new source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'omegahealthcaremanagementservices')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /omegahealthcaremanagementservices[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'omegahealthcaremanagementservices')

  const report = generateCompanyCoverageReport({
    csvText: 'Omega Healthcare Management Services,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Omega Healthcare Management Services', 'omegahealthcaremanagementservices', 'Omega Healthcare Management Services']],
  )
})
