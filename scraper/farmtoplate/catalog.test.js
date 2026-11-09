import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Farm To Plate is registered with the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'farmtoplate')

  assert.ok(provider, 'Expected Farm To Plate provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Farm To Plate')
  assert.equal(provider.companyCareerPage, 'https://www.farmtoplate.io/about-us/careers-and-joining-the-team/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-page-sitemap-plus-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-page-sitemap+verified-first-party-careers-page+detail-pages+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'farmtoplate.io')
  assert.match(provider.modulePath, /farmtoplate[\\/]script\.js$/i)
})

test('Farm To Plate and Farm to plate both match company coverage through normalized provider naming', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Farm To Plate,\nFarm to plate,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Farm To Plate', 'farmtoplate', 'Farm To Plate'],
      ['Farm to plate', 'farmtoplate', 'Farm To Plate'],
    ],
  )
})

test('Farm To Plate is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'farmtoplate')

  assert.ok(scraper, 'Expected buildScrapers() to return the Farm To Plate scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'farmtoplate')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.farmtoplate.io/about-us/careers-and-joining-the-team/')
  assert.match(scraper.dryRunFile, /farmtoplate[\\/]jobs\.json$/i)
})
