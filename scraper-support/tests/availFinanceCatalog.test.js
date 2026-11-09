import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Avail Finance as a parked-domain and unresolved-host sentinel source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'availfinance')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Avail Finance')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://availfinance.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'parked-domain-and-unresolved-host-validation')
  assert.equal(provider.extractionStrategy, 'verified-parked-and-unresolved-first-party-surfaces-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'availfinance.com')
  assert.match(provider.modulePath, /availfinance[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Avail Finance to availfinance', () => {
  const scraper = buildScrapers().find((item) => item.name === 'availfinance')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /availfinance[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'availfinance')

  const report = generateCompanyCoverageReport({
    csvText: 'Avail Finance,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avail Finance', 'availfinance', 'Avail Finance']],
  )
})
