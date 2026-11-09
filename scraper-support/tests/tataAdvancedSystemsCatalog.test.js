import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tata Advanced Systems as an official careers handoff monitor', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tataadvancedsystems')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Tata Advanced Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.tataadvancedsystems.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-page-plus-tcs-platform-handoff-shell-monitor')
  assert.equal(provider.extractionStrategy, 'official-careers-page+tcs-platform-handoff+unreachable-or-shell-monitor')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tataadvancedsystems.com')
  assert.match(provider.modulePath, /tataadvancedsystems[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Tata Advanced Systems without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tataadvancedsystems')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tataadvancedsystems[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'tataadvancedsystems')

  const report = generateCompanyCoverageReport({
    csvText: 'Tata Advanced Systems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tata Advanced Systems', 'tataadvancedsystems', 'Tata Advanced Systems']],
  )
})
