import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Z1 Media is registered against the verified careers handoff and Lever endpoint', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'z1media')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Z1 Media')
  assert.equal(provider.companyCareerPage, 'https://www.z1tech.com/careers')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'legacy-homepage-redirect-plus-careers-page-plus-lever-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+lever-jobs-api+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'z1tech.com')
  assert.match(provider.modulePath, /z1media[\\/]script\.js$/i)
})

test('Z1 Media matches company coverage directly and remains runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Z1 Media\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Z1 Media', 'z1media', 'Z1 Media']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'z1media')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'z1media')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.z1tech.com/careers')
  assert.match(scraper.dryRunFile, /z1media[\\/]jobs\.json$/i)
})
