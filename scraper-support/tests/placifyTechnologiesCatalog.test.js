import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Placify Technologies is registered against the verified official homepage with no public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'placifytechnologies')

  assert.ok(provider, 'Expected Placify Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Placify Technologies')
  assert.equal(provider.companyCareerPage, 'https://placifytechnologies.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'placifytechnologies.in')
  assert.match(provider.modulePath, /placifytechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Placify Technologies'), false)
})

test('Placify Technologies matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Placify Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Placify Technologies', 'placifytechnologies', 'Placify Technologies']],
  )
})

test('Placify Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'placifytechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Placify Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'placifytechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://placifytechnologies.in/')
  assert.match(scraper.dryRunFile, /placifytechnologies[\\/]jobs\.json$/i)
})
