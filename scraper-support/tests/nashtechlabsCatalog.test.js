import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Nash Tech Labs is registered against the verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nashtechlabs')

  assert.ok(provider, 'Expected Nash Tech Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nash Tech Labs')
  assert.equal(provider.companyCareerPage, 'https://www.nashtechlabs.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-role-cards+same-site-pdf-jd-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nashtechlabs.com')
  assert.match(provider.modulePath, /nashtechlabs[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nash Tech Labs'), false)
})

test('Nash Tech Labs matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Nash Tech Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nash Tech Labs', 'nashtechlabs', 'Nash Tech Labs']],
  )
})

test('Nash Tech Labs is runnable through the shared scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nashtechlabs')

  assert.ok(scraper, 'Expected buildScrapers() to return the Nash Tech Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nashtechlabs')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.nashtechlabs.com/careers')
  assert.match(scraper.dryRunFile, /nashtechlabs[\\/]jobs\.json$/i)
})
