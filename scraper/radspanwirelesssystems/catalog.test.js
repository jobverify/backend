import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('RADSPAN Wireless Systems is registered as a no-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'radspanwirelesssystems')

  assert.ok(provider, 'Expected RADSPAN Wireless Systems provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'RADSPAN Wireless Systems')
  assert.equal(provider.companyCareerPage, 'https://www.radspanwirelesssystems.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://radspanwirelesssystems.com/',
    'https://www.radspan.com/',
    'https://radspan.com/',
    'https://www.radspanwirelesssystems.com/careers',
    'https://radspanwirelesssystems.com/careers',
    'https://www.radspan.com/careers',
    'https://radspan.com/careers',
    'https://www.radspanwirelesssystems.com/jobs',
    'https://radspanwirelesssystems.com/jobs',
    'https://www.radspan.com/jobs',
    'https://radspan.com/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-homepages-and-careers-routes-dns-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepages-and-careers-routes-unresolvable-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'radspanwirelesssystems.com')
  assert.match(provider.modulePath, /radspanwirelesssystems[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'RADSPAN Wireless Systems'), false)
})

test('RADSPAN Wireless Systems matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'RADSPAN Wireless Systems,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RADSPAN Wireless Systems', 'radspanwirelesssystems', 'RADSPAN Wireless Systems']],
  )
})

test('RADSPAN Wireless Systems is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'radspanwirelesssystems')

  assert.ok(scraper, 'Expected buildScrapers() to return the RADSPAN Wireless Systems scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'radspanwirelesssystems')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.radspanwirelesssystems.com/')
  assert.match(scraper.dryRunFile, /radspanwirelesssystems[\\/]jobs\.json$/i)
})
