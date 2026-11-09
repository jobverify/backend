import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bharat Financial Inclusion Limited as a first-party email-apply source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bharatfinancialinclusionlimited')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Bharat Financial Inclusion Limited')
  assert.equal(provider.companyCareerPage, 'https://www.bfil.co.in/apply-for-job.php')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-role-lists+shared-email-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bfil.co.in')
  assert.match(provider.modulePath, /bharatfinancialinclusionlimited[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Bharat Financial Inclusion rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bharatfinancialinclusionlimited')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bharatfinancialinclusionlimited')
  assert.match(scraper.dryRunFile, /bharatfinancialinclusionlimited[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Financial Inclusion,\nBharat Financial Inclusion Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Bharat Financial Inclusion', 'bharatfinancialinclusionlimited', 'Bharat Financial Inclusion Limited'],
      ['Bharat Financial Inclusion Limited', 'bharatfinancialinclusionlimited', 'Bharat Financial Inclusion Limited'],
    ],
  )
})
