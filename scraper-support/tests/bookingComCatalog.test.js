import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Booking.com as a public Jibe apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bookingcom')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Booking.com')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'jibe')
  assert.equal(provider.companyCareerPage, 'https://jobs.booking.com/booking/jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-number')
  assert.equal(provider.extractionStrategy, 'api')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.booking.com')
})

test('buildScrapers and company coverage resolve Booking.com to bookingcom', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bookingcom')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bookingcom')
  assert.match(scraper.dryRunFile, /bookingcom[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Booking.com,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Booking.com', 'bookingcom', 'Booking.com']],
  )
})
