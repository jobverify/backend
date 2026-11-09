import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('iWave Systems is registered as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iwavesystems')

  assert.ok(provider, 'Expected iWave Systems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iWave Systems')
  assert.equal(provider.companyCareerPage, 'https://www.iwavesystems.com/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-homepage-plus-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-inline-text-job-board-and-email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iwavesystems.com')
  assert.match(provider.modulePath, /iwavesystems[\\/]script\.js$/i)
})

test('iWave Systems is runnable through the scraper provider catalog and company coverage', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iwavesystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the iWave Systems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iwavesystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.iwavesystems.com/career/')
  assert.match(scraper.dryRunFile, /iwavesystems[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'iWave Systems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iWave Systems', 'iwavesystems', 'iWave Systems']],
  )
})
