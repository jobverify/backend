import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SAH Group of Companies is registered as a placeholder-site sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sahgroupofcompanies')

  assert.ok(provider, 'Expected SAH Group of Companies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SAH Group of Companies')
  assert.equal(provider.companyCareerPage, 'https://www.sah.co.in/careers')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.sah.co.in/',
    'https://www.sah.co.in/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-and-jobs-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-placeholder-homepage+verified-missing-first-party-careers-pages-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sah.co.in')
  assert.match(provider.modulePath, /sahgroupofcompanies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SAH Group of Companies'), false)
})

test('SAH Group of Companies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SAH Group of Companies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SAH Group of Companies', 'sahgroupofcompanies', 'SAH Group of Companies']],
  )
})

test('SAH Group of Companies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sahgroupofcompanies')

  assert.ok(scraper, 'Expected buildScrapers() to return the SAH Group of Companies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sahgroupofcompanies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.sah.co.in/careers')
  assert.match(scraper.dryRunFile, /sahgroupofcompanies[\\/]jobs\.json$/i)
})
