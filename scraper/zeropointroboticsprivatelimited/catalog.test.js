import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'zeropointroboticsprivatelimited'
const COMPANY = 'Zeropoint Robotics Private Limited'
const HOMEPAGE_URL = 'http://zeropointrobotics.com/'

test('Zeropoint Robotics Private Limited is registered as a verified HugeDomains sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Zeropoint Robotics Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'http://www.zeropointrobotics.com/',
    'http://zeropointrobotics.com/careers',
    'http://www.zeropointrobotics.com/careers',
    'http://zeropointrobotics.com/jobs',
    'http://www.zeropointrobotics.com/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-www-homepage-plus-careers-and-jobs-route-parked-domain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-hugedomains-parked-homepage+verified-hugedomains-parked-www-homepage+verified-hugedomains-parked-careers-and-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'zeropointrobotics.com')
  assert.match(provider.modulePath, /zeropointroboticsprivatelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Zeropoint Robotics Private Limited resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
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

  assert.ok(scraper, 'Expected buildScrapers() to return the Zeropoint Robotics Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /zeropointroboticsprivatelimited[\\/]jobs\.json$/i)
})
