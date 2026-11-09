import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Numeric Technologies is registered against the verified first-party US careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'numerictechnologies')

  assert.ok(provider, 'Expected Numeric Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Numeric Technologies')
  assert.equal(provider.companyCareerPage, 'https://numerictech.com/careers/united-states/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'single-first-party-us-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-page-sitemap-route+verified-first-party-us-careers-page+inline-public-openings+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'numerictech.com')
  assert.match(provider.modulePath, /numerictechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Numeric technologies'), false)
})

test('Numeric Technologies matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Numeric technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Numeric technologies', 'numerictechnologies', 'Numeric Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'numerictechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Numeric Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'numerictechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://numerictech.com/careers/united-states/')
  assert.match(scraper.dryRunFile, /numerictechnologies[\\/]jobs\.json$/i)
})
