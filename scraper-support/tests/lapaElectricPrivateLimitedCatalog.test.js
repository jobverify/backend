import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Lapa Electric Private Limited is registered as a verified first-party zero-job scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lapaelectricprivatelimited')

  assert.ok(
    provider,
    'Expected Lapa Electric Private Limited provider to be registered in customProviders.json',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lapa Electric Private Limited')
  assert.equal(provider.companyCareerPage, 'https://lapaelectric.com/lapa-careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-career-sitemap-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-careers-contact-form-plus-narrative-career-sitemap-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lapaelectric.com')
  assert.match(provider.modulePath, /lapaelectricprivatelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lapa Electric Private Limited'), false)
})

test('Lapa Electric Private Limited matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lapa Electric Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lapa Electric Private Limited', 'lapaelectricprivatelimited', 'Lapa Electric Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'lapaelectricprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lapa Electric Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lapaelectricprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://lapaelectric.com/lapa-careers/')
  assert.match(scraper.dryRunFile, /lapaelectricprivatelimited[\\/]jobs\.json$/i)
})
