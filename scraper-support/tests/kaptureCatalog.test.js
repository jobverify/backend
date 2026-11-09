import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Kapture as a Keka embed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kapture')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Kapture')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.companyCareerPage, 'https://www.kapture.cx/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'window-khConfig+active-keka-embed-api+jobdetails+applyjob')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kapture.cx')
  assert.match(provider.modulePath, /kapture[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Kapture to the kapture source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kapture')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /kapture[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'kapture')

  const report = generateCompanyCoverageReport({
    csvText: 'Kapture,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kapture', 'kapture', 'Kapture']],
  )
})
