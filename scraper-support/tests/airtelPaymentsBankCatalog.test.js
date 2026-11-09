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
const airtelPaymentsBankModulePath = path.resolve(currentDir, '../../scraper/airtelpaymentsbank/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/airtelpaymentsbank/catalog.js')
  } catch {
    assert.fail('Expected Airtel Payments Bank catalog module at ../../scraper/airtelpaymentsbank/catalog.js')
  }
}

const loadAirtelPaymentsBankModule = async () => {
  try {
    return await import('../../scraper/airtelpaymentsbank/script.js')
  } catch {
    assert.fail('Expected Airtel Payments Bank scraper module at ../../scraper/airtelpaymentsbank/script.js')
  }
}

test('Airtel Payments Bank local catalog captures the verified guarded bank pages and shared Airtel careers sentinel state', async () => {
  const { AIRTEL_PAYMENTS_BANK_CATALOG } = await loadCatalogModule()
  const airtelPaymentsBank = await loadAirtelPaymentsBankModule()

  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.source, 'airtelpaymentsbank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.companyName, 'Airtel Payments Bank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.officialBrandName, 'Airtel Payments Bank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.adapter, 'script')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.companyCareerPage, 'https://www.airtelpayments.bank.in/')
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.aboutPageUrl,
    'https://www.airtelpayments.bank.in/static/about-us',
  )
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.parentCareersPage, 'https://careers.airtel.com/')
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.sharedCareersBundleUrl,
    'https://careers.airtel.com/static/js/main.57023176.js',
  )
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.sharedDarwinboxUrl,
    'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.sharedCareersApiUrl,
    'https://careersapi.airtel.com/',
  )
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.companyDomain, 'airtelpayments.bank.in')
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.countryFilter, 'India')
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.paginationStrategy,
    '403-guarded-bank-pages-plus-shared-airtel-careers-shell-bundle-and-darwinbox-checks',
  )
  assert.equal(
    AIRTEL_PAYMENTS_BANK_CATALOG.extractionStrategy,
    '403-guarded-bank-homepage+403-guarded-bank-about-page+shared-airtel-careers-shell+shared-bundle-reference+shared-darwinbox-shell+no-distinct-bank-jobs-route-return-empty',
  )
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.parser, 'custom-script')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.verifiedOn, '2026-08-07')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.dryRunFile, 'airtelpaymentsbank/jobs.json')
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.airtelpayments\.bank\.in\//i,
  )
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /cloudflare-guarded http 403 surfaces/i,
  )
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.airtel\.com\//i,
  )
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.airtel\.com\/static\/js\/main\.57023176\.js/i,
  )
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/airtel\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(
    AIRTEL_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /no distinct Airtel Payments Bank public jobs route/i,
  )
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.modulePath, airtelPaymentsBankModulePath)

  assert.equal(
    airtelPaymentsBank.PROVIDER_METADATA.source,
    AIRTEL_PAYMENTS_BANK_CATALOG.source,
  )
  assert.equal(
    airtelPaymentsBank.PROVIDER_METADATA.companyName,
    AIRTEL_PAYMENTS_BANK_CATALOG.companyName,
  )
  assert.equal(
    airtelPaymentsBank.PROVIDER_METADATA.aboutPageUrl,
    AIRTEL_PAYMENTS_BANK_CATALOG.aboutPageUrl,
  )
  assert.equal(
    airtelPaymentsBank.PROVIDER_METADATA.parentCareersPage,
    AIRTEL_PAYMENTS_BANK_CATALOG.parentCareersPage,
  )
  assert.equal(
    airtelPaymentsBank.PROVIDER_METADATA.sharedDarwinboxUrl,
    AIRTEL_PAYMENTS_BANK_CATALOG.sharedDarwinboxUrl,
  )
})

test('Airtel Payments Bank local catalog hydrates into coverage without needing a shared alias entry', async () => {
  const { AIRTEL_PAYMENTS_BANK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AIRTEL_PAYMENTS_BANK_CATALOG)

  assert.equal(provider.companyName, 'Airtel Payments Bank')
  assert.equal(provider.companyDomain, 'airtelpayments.bank.in')
  assert.match(provider.modulePath, /airtelpaymentsbank[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /airtelpaymentsbank[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airtel Payments Bank\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel Payments Bank', 'airtelpaymentsbank', 'Airtel Payments Bank']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Airtel Payments Bank'),
    false,
  )
})

test('buildScrapers and company coverage resolve Airtel Payments Bank from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airtelpaymentsbank')
  const scraper = buildScrapers().find((item) => item.name === 'airtelpaymentsbank')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airtel Payments Bank')
  assert.equal(provider.companyCareerPage, 'https://www.airtelpayments.bank.in/')
  assert.equal(provider.paginationStrategy, '403-guarded-bank-pages-plus-shared-airtel-careers-shell-bundle-and-darwinbox-checks')
  assert.equal(provider.extractionStrategy, '403-guarded-bank-homepage+403-guarded-bank-about-page+shared-airtel-careers-shell+shared-bundle-reference+shared-darwinbox-shell+no-distinct-bank-jobs-route-return-empty')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /cloudflare-guarded http 403 surfaces/i)
  assert.match(scraper.dryRunFile, /airtelpaymentsbank[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airtel Payments Bank\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel Payments Bank', 'airtelpaymentsbank', 'Airtel Payments Bank']],
  )
})
