import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('JBM is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jbm')

  assert.ok(provider, 'Expected JBM provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'JBM')
  assert.equal(provider.companyCareerPage, 'https://www.jbmgroup.com/our-people/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-careers-contact-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jbmgroup.com')
  assert.match(provider.modulePath, /jbm[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'JBM'), false)
})

test('JBM matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'JBM,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JBM', 'jbm', 'JBM']],
  )
})

test('JBM is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jbm')

  assert.ok(scraper, 'Expected buildScrapers() to return the JBM scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jbm')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.jbmgroup.com/our-people/')
  assert.match(scraper.dryRunFile, /jbm[\\/]jobs\.json$/i)
})
