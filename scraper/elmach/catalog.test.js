import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Elmach is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'elmach')

  assert.ok(provider, 'Expected Elmach provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ELMACH Packages India Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://elmach.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-robots-sitemap-and-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-robots-sitemap-and-careers-routes+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'elmach.com')
  assert.match(provider.modulePath, /elmach[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Elmach'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ELMACH Packages India Pvt. Ltd.'), false)
})

test('Elmach resolves directly from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Elmach,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Elmach', 'elmach', 'ELMACH Packages India Pvt. Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'elmach')

  assert.ok(scraper, 'Expected buildScrapers() to return the Elmach sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'elmach')
  assert.equal(scraper.provider.companyCareerPage, 'https://elmach.com/')
  assert.match(scraper.dryRunFile, /elmach[\\/]jobs\.json$/i)
})
