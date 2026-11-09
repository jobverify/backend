import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'pyzqlltd'
const COMPANY = 'PyzqL Ltd'
const HOMEPAGE_URL = 'https://pyzqlltd.com/'

test('PyzqL Ltd is registered as an unresolved multi-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected PyzqL Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.pyzqlltd.com/',
    'https://pyzqlltd.in/',
    'https://www.pyzqlltd.in/',
    'https://pyzqlltd.co.in/',
    'https://www.pyzqlltd.co.in/',
    'https://pyzqltd.com/',
    'https://www.pyzqltd.com/',
    'https://pyzqltd.in/',
    'https://www.pyzqltd.in/',
    'https://pyzqltd.co.in/',
    'https://www.pyzqltd.co.in/',
    'https://pyzql.com/',
    'https://www.pyzql.com/',
    'https://pyzql.in/',
    'https://www.pyzql.in/',
    'https://pyzql.co.in/',
    'https://www.pyzql.co.in/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'candidate-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-candidate-first-party-hosts-unresolved-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pyzqlltd.com')
  assert.match(provider.modulePath, /pyzqlltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('PyzqL Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the PyzqL Ltd sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /pyzqlltd[\\/]jobs\.json$/i)
})
