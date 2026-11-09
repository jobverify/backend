import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Torrent Gas as an official zero-public-jobs careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'torrentgas')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Torrent Gas')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.torrentgas.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-login-gate')
  assert.equal(provider.extractionStrategy, 'verified-careers-copy-plus-login-gate-zero-public-job-records')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.torrentgas.com')
  assert.match(provider.modulePath, /torrentgas[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Torrent Gas without alias registrations', () => {
  const scraper = buildScrapers().find((item) => item.name === 'torrentgas')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'torrentgas')
  assert.match(scraper.dryRunFile, /torrentgas[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Torrent Gas,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Torrent Gas', 'torrentgas', 'Torrent Gas']],
  )
})
