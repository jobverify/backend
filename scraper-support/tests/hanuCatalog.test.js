import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Hanu is registered as a verified first-party redirect-only zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hanu')

  assert.ok(provider, 'Expected Hanu provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hanu')
  assert.equal(provider.companyCareerPage, 'https://www.hanu.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-redirect-plus-common-careers-route-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-hanu-homepage-redirect-plus-redirect-only-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hanu.com')
  assert.match(provider.modulePath, /hanu[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hanu'), false)
})

test('Hanu matches company coverage directly from provider metadata and is runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Hanu,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hanu', 'hanu', 'Hanu']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'hanu')

  assert.ok(scraper, 'Expected buildScrapers() to return the Hanu scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hanu')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.hanu.com/')
  assert.match(scraper.dryRunFile, /hanu[\\/]jobs\.json$/i)
})
