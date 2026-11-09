import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes BankBazaar as a verified email-only careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bankbazaar')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BankBazaar')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, "official-company-careers-cv-intake")
  assert.equal(provider.companyCareerPage, 'https://www.bankbazaar.com/careers.html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, "current-homepage-and-cv-email-intake-with-unresolved-vacancy-inventory")
  assert.equal(provider.extractionStrategy, "official-current-careers-identity+general-cv-intake-observation+explicit-unknown-inventory")
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bankbazaar.com')
  assert.match(provider.modulePath, /bankbazaar[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BankBazaar to bankbazaar', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bankbazaar')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bankbazaar[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'bankbazaar')

  const report = generateCompanyCoverageReport({
    csvText: 'BankBazaar,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BankBazaar', 'bankbazaar', 'BankBazaar']],
  )
})
