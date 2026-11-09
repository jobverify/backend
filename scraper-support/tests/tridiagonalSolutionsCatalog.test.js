import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tridiagonal Solutions as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tridiagonalsolutions')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tridiagonal Solutions Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.tridiagonal.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-nextjs-careers-page+static-job-rows')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tridiagonal.com')
  assert.match(provider.modulePath, /tridiagonalsolutions[\\/]script\.js$/i)
})

test('Tridiagonal Solutions coverage resolves the legal and site-shortened company names without extra aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tridiagonalsolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tridiagonalsolutions[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tridiagonalsolutions')

  const report = generateCompanyCoverageReport({
    csvText: [
      'Tridiagonal Solutions,',
      'Tridiagonal Solutions Pvt Ltd,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Tridiagonal Solutions', 'tridiagonalsolutions', 'Tridiagonal Solutions Pvt Ltd'],
      ['Tridiagonal Solutions Pvt Ltd', 'tridiagonalsolutions', 'Tridiagonal Solutions Pvt Ltd'],
    ],
  )
})
