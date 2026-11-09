import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'rsmcybersolutions'
const COMPANY = 'RSM Cyber Solutions'
const HOMEPAGE_URL = 'https://rsmcybersolutions.com/'

test('RSM Cyber Solutions is registered as a verified absent-first-party-surface sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected RSM Cyber Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.rsmcybersolutions.com/',
    'https://rsmcybersolutions.in/',
    'https://www.rsmcybersolutions.in/',
    'https://rsmcybersolutions.co.in/',
    'https://www.rsmcybersolutions.co.in/',
    'https://rsmcyber.com/',
    'https://www.rsmcyber.com/',
    'https://rsmcyber.in/',
    'https://www.rsmcyber.in/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-homepages-and-domain-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-host-candidates-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rsmcybersolutions.com')
  assert.match(provider.modulePath, /rsmcybersolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('RSM Cyber Solutions matches company coverage directly from provider metadata', () => {
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
})

test('RSM Cyber Solutions is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the RSM Cyber Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /rsmcybersolutions[\\/]jobs\.json$/i)
})
