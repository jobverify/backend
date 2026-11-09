import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'movidutechnologyprivatelimited'
const COMPANY = 'Movidu Technology Private Limited'

test('Movidu Technology Private Limited is registered as a verified parked-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Movidu Technology Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, 'http://movidu.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'http://www.movidu.com/',
    'http://movidu.com/careers',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-www-homepage-plus-careers-route-parked-domain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-sedo-parked-homepage+verified-sedo-parked-www-homepage+verified-sedo-parked-careers-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'movidu.com')
  assert.match(provider.modulePath, /movidutechnologyprivatelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Movidu Technology Private Limited resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Movidu Technology Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'http://movidu.com/')
  assert.match(scraper.dryRunFile, /movidutechnologyprivatelimited[\\/]jobs\.json$/i)
})
