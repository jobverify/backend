import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('tringapps is registered against its official first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tringapps')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'tringapps')
  assert.equal(provider.companyCareerPage, 'https://tringapps.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-careers-page+verified-contact-page+inline-role-cards+same-page-apply-form+exclude-usa-roles',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tringapps.com')
  assert.match(provider.modulePath, /tringapps[\\/]script\.js$/i)
})

test('tringapps matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'tringapps,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['tringapps', 'tringapps', 'tringapps']],
  )
})

test('tringapps is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'tringapps')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tringapps')
  assert.equal(scraper.provider.companyCareerPage, 'https://tringapps.com/careers/')
  assert.match(scraper.dryRunFile, /tringapps[\\/]jobs\.json$/i)
})
