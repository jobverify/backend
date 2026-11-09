import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Store King is registered as a verified first-party no-public-careers sentinel with safe whitespace alias coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'storeking')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'StoreKing')
  assert.equal(provider.companyCareerPage, 'https://storeking.in/contact')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'about-contact-and-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-about-page-careers-contact-handoff+verified-contact-page-job-seeker-form+missing-public-careers-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'storeking.in')
  assert.match(provider.modulePath, /storeking[\\/]script\.js$/i)
  assert.equal(companyAliases['Store King'], 'storeking')
})

test('Store King resolves through alias coverage and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Store King,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Store King', 'storeking', 'StoreKing']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'storeking')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'storeking')
  assert.equal(scraper.provider.companyCareerPage, 'https://storeking.in/contact')
  assert.match(scraper.dryRunFile, /storeking[\\/]jobs\.json$/i)
})
