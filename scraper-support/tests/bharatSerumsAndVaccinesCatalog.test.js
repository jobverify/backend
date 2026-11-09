import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bharat Serums and Vaccines as a verified nonlisting first-party careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatserumsandvaccines')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.companyName, 'Bharat Serums and Vaccines')
  assert.equal(provider.companyCareerPage, 'https://bsvgroup.com/work-at-bsv/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-dedicated-careers-page-plus-common-jobs-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-plus-dedicated-careers-page-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bsvgroup.com')
  assert.match(provider.modulePath, /bharatserumsandvaccines[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Bharat Serums and Vaccines to bharatserumsandvaccines', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatserumsandvaccines')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bharatserumsandvaccines')
  assert.match(scraper.dryRunFile, /bharatserumsandvaccines[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Serums and Vaccines,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Bharat Serums and Vaccines', 'bharatserumsandvaccines', 'bharatserumsandvaccines']],
  )
})
