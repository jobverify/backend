import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('blueBriX is registered against its official first-party careers portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bluebrix')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'blueBriX')
  assert.equal(provider.companyCareerPage, 'https://careers.bluebrix.health/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-role-cards+same-page-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.bluebrix.health')
  assert.match(provider.modulePath, /bluebrix[\\/]script\.js$/i)
})

test('blueBriX matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'blueBriX\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['blueBriX', 'bluebrix', 'blueBriX']],
  )
})

test('blueBriX is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bluebrix')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bluebrix')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.bluebrix.health/')
  assert.match(scraper.dryRunFile, /bluebrix[\\/]jobs\.json$/i)
})
