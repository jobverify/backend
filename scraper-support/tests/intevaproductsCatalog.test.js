import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Inteva Products is registered as a verified first-party zero-job scraper for India coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intevaproducts')

  assert.ok(provider, 'Expected Inteva Products provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Inteva Products')
  assert.equal(provider.companyCareerPage, 'https://www.intevaproducts.com/careers/apply-online/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-embedded-appone-location-index')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+embedded-appone-public-board-without-india-locations-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'intevaproducts.com')
  assert.match(provider.modulePath, /intevaproducts[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Inteva Products'), false)
})

test('Inteva Products matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Inteva Products,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Inteva Products', 'intevaproducts', 'Inteva Products']],
  )
})

test('Inteva Products is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'intevaproducts')

  assert.ok(scraper, 'Expected buildScrapers() to return the Inteva Products scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intevaproducts')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.intevaproducts.com/careers/apply-online/')
  assert.match(scraper.dryRunFile, /intevaproducts[\\/]jobs\.json$/i)
})
