import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const deutscheBankModulePath = path.resolve(currentDir, '../../scraper/deutschebank/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deutschebank/catalog.js')
  } catch {
    assert.fail('Expected Deutsche Bank catalog module at ../../scraper/deutschebank/catalog.js')
  }
}

test('Deutsche Bank local catalog captures the verified first-party careers surface and public Beesite job APIs', async () => {
  const {
    DEUTSCHE_BANK_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(DEUTSCHE_BANK_CATALOG.source, 'deutschebank')
  assert.equal(DEUTSCHE_BANK_CATALOG.companyName, 'Deutsche Bank')
  assert.equal(DEUTSCHE_BANK_CATALOG.officialBrandName, 'Deutsche Bank')
  assert.equal(DEUTSCHE_BANK_CATALOG.adapter, 'script')
  assert.equal(DEUTSCHE_BANK_CATALOG.modulePath, deutscheBankModulePath)
  assert.equal(DEUTSCHE_BANK_CATALOG.dryRunFile, 'deutschebank/jobs.json')
  assert.equal(DEUTSCHE_BANK_CATALOG.officialHomepageUrl, 'https://careers.db.com/')
  assert.equal(
    DEUTSCHE_BANK_CATALOG.companyCareerPage,
    'https://careers.db.com/professionals/search-roles/',
  )
  assert.equal(DEUTSCHE_BANK_CATALOG.companyDomain, 'db.com')
  assert.equal(
    DEUTSCHE_BANK_CATALOG.publicCountryLookupUrl,
    'https://api-deutschebank.beesite.de/lookup/country/lang/2',
  )
  assert.equal(
    DEUTSCHE_BANK_CATALOG.publicSearchApiUrl,
    'https://api-deutschebank.beesite.de/search',
  )
  assert.equal(
    DEUTSCHE_BANK_CATALOG.publicJobDetailApiPrefix,
    'https://api-deutschebank.beesite.de/jobhtml/',
  )
  assert.equal(DEUTSCHE_BANK_CATALOG.verifiedIndiaCountryId, 81)
  assert.equal(DEUTSCHE_BANK_CATALOG.verifiedIndiaCountryLabel, 'India')
  assert.equal(DEUTSCHE_BANK_CATALOG.verifiedIndiaSampleJobId, '74791')
  assert.equal(
    DEUTSCHE_BANK_CATALOG.verifiedIndiaSampleApplyUrl,
    'https://db.wd3.myworkdayjobs.com/DBWebsite/job/Mumbai-Capital/Salesperson---VP_R0443973/apply',
  )
  assert.equal(DEUTSCHE_BANK_CATALOG.atsPlatform, 'first-party-beesite-search-api')
  assert.equal(DEUTSCHE_BANK_CATALOG.countryFilter, 'India')
  assert.equal(
    DEUTSCHE_BANK_CATALOG.paginationStrategy,
    'verified-first-party-careers-pages-plus-beesite-countitem-expansion',
  )
  assert.equal(
    DEUTSCHE_BANK_CATALOG.extractionStrategy,
    'verified-careers-homepage+verified-search-roles-page+public-country-lookup+public-professional-search-api+public-job-detail-api',
  )
  assert.equal(DEUTSCHE_BANK_CATALOG.parser, 'custom-script')
  assert.equal(DEUTSCHE_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DEUTSCHE_BANK_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(DEUTSCHE_BANK_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.db\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.db\.com\/professionals\/search-roles\//i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api-deutschebank\.beesite\.de\/lookup\/country\/lang\/2/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api-deutschebank\.beesite\.de\/search\/\?data=/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api-deutschebank\.beesite\.de\/jobhtml\/74791\.json/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b234 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/i)
})

test('Deutsche Bank local catalog hydrates into coverage without needing an alias entry', async () => {
  const { DEUTSCHE_BANK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DEUTSCHE_BANK_CATALOG)

  assert.equal(provider.companyName, 'Deutsche Bank')
  assert.equal(provider.companyDomain, 'db.com')
  assert.match(provider.modulePath, /deutschebank[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /deutschebank[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Deutsche Bank\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deutsche Bank', 'deutschebank', 'Deutsche Bank']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Deutsche Bank'), false)
})

test('buildScrapers and company coverage resolve Deutsche Bank from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deutschebank')
  const scraper = buildScrapers().find((item) => item.name === 'deutschebank')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Deutsche Bank')
  assert.equal(provider.companyCareerPage, 'https://careers.db.com/professionals/search-roles/')
  assert.match(scraper.dryRunFile, /deutschebank[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Deutsche Bank\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Deutsche Bank', 'deutschebank', 'Deutsche Bank']],
  )
})
