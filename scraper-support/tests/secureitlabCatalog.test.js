import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SecureITLab on the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'secureitlab')

  assert.ok(provider, 'Expected SecureITLab provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'SecureITLab')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://secureitlab.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-page+static-role-cards+shared-mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'secureitlab.com')
  assert.match(provider.modulePath, /secureitlab[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SECUREITLAB'), false)
})

test('SecureITLab matches company coverage directly from provider metadata for the exact CSV company', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SECUREITLAB,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SECUREITLAB', 'secureitlab', 'SecureITLab']],
  )
})

test('buildScrapers exposes a runnable SecureITLab scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'secureitlab')

  assert.ok(scraper, 'Expected buildScrapers() to return the SecureITLab scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'secureitlab')
  assert.equal(scraper.provider.companyCareerPage, 'https://secureitlab.com/careers')
  assert.match(scraper.dryRunFile, /secureitlab[\\/]jobs\.json$/i)
})
