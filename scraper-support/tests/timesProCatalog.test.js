import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes TimesPro on the verified official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'timespro')

  assert.ok(provider, 'Expected TimesPro provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TimesPro')
  assert.equal(provider.companyCareerPage, 'https://timespro.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'timespro.com')
  assert.match(provider.modulePath, /timespro[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable TimesPro scraper and exact CSV coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'timespro')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'timespro')
  assert.match(scraper.dryRunFile, /timespro[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Timespro,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Timespro', 'timespro', 'TimesPro']],
  )
})
