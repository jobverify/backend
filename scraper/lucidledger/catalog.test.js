import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'lucidledger'
const COMPANY = 'Lucid Ledger'

test('Lucid Ledger is registered as a verified ConnectYourDomain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Lucid Ledger provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, 'https://lucidledger.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.lucidledger.com/',
    'https://lucidledger.com/sitemap.xml',
    'https://www.lucidledger.com/sitemap.xml',
    'https://lucidledger.com/careers',
    'https://www.lucidledger.com/careers',
    'https://lucidledger.com/jobs',
    'https://www.lucidledger.com/jobs',
    'https://lucidledger.com/join-us',
    'https://www.lucidledger.com/join-us',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemaps-and-common-careers-route-connectyourdomain-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-connectyourdomain-homepages+verified-connectyourdomain-sitemaps+verified-connectyourdomain-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lucidledger.com')
  assert.match(provider.modulePath, /lucidledger[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Lucid Ledger resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
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

  assert.ok(scraper, 'Expected buildScrapers() to return the Lucid Ledger scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'https://lucidledger.com/')
  assert.match(scraper.dryRunFile, /lucidledger[\\/]jobs\.json$/i)
})
