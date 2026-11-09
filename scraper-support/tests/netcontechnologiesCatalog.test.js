import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Netcon Technologies is registered against the verified Arche careers surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'netcontechnologies')

  assert.ok(provider, 'Expected Netcon Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netcon Technologies')
  assert.equal(provider.companyCareerPage, 'https://arche.global/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-page-plus-jobs-sitemap')
  assert.equal(
    provider.extractionStrategy,
    'verified-arche-careers+verified-arche-jobs+sitemap-job-details+shared-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'arche.global')
  assert.match(provider.modulePath, /netcontechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Netcon Technologies'), false)
})

test('Netcon Technologies matches company coverage directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Netcon Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Netcon Technologies', 'netcontechnologies', 'Netcon Technologies']],
  )
})

test('Netcon Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'netcontechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Netcon Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'netcontechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://arche.global/careers')
  assert.match(scraper.dryRunFile, /netcontechnologies[\\/]jobs\.json$/i)
})
