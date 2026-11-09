import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const finoPaymentsBankModulePath = path.resolve(currentDir, '../../scraper/finopaymentsbank/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/finopaymentsbank/catalog.js')
  } catch {
    assert.fail('Expected Fino Payments Bank catalog module at ../../scraper/finopaymentsbank/catalog.js')
  }
}

const loadFinoPaymentsBankModule = async () => {
  try {
    return await import('../../scraper/finopaymentsbank/script.js')
  } catch {
    assert.fail('Expected Fino Payments Bank scraper module at ../../scraper/finopaymentsbank/script.js')
  }
}

test('Fino Payments Bank local catalog captures the verified non-listing careers surface', async () => {
  const { FINO_PAYMENTS_BANK_CATALOG } = await loadCatalogModule()
  const finoPaymentsBank = await loadFinoPaymentsBankModule()

  assert.equal(FINO_PAYMENTS_BANK_CATALOG.source, 'finopaymentsbank')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.companyName, 'Fino Payments Bank')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.officialBrandName, 'Fino Payments Bank')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.adapter, 'script')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.legacyHomepageUrl, 'https://www.finobank.com/')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.homepageUrl, 'https://www.fino.bank.in/')
  assert.equal(
    FINO_PAYMENTS_BANK_CATALOG.companyCareerPage,
    'https://www.fino.bank.in/company/careers',
  )
  assert.deepEqual(FINO_PAYMENTS_BANK_CATALOG.alternateRouteUrls, [
    'https://www.fino.bank.in/careers',
    'https://www.fino.bank.in/career',
    'https://www.fino.bank.in/jobs',
    'https://www.fino.bank.in/join-us',
    'https://www.fino.bank.in/work-with-us',
    'https://www.fino.bank.in/current-openings',
  ])
  assert.equal(
    FINO_PAYMENTS_BANK_CATALOG.atsPlatform,
    'official-company-careers-nonlisting',
  )
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.companyDomain, 'fino.bank.in')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.countryFilter, 'India')
  assert.equal(
    FINO_PAYMENTS_BANK_CATALOG.paginationStrategy,
    'legacy-homepage-redirect-plus-homepage-careers-handoff-plus-nonlisting-careers-page-and-404-alternate-route-validation',
  )
  assert.equal(
    FINO_PAYMENTS_BANK_CATALOG.extractionStrategy,
    'verified-legacy-homepage-redirect+verified-homepage-careers-link+verified-careers-page-open-roles-no-roles-found+verified-alternate-careers-routes-404-return-empty',
  )
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.parser, 'custom-script')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.dryRunFile, 'finopaymentsbank/jobs.json')
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.finobank\.com\//i,
  )
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.fino\.bank\.in\//i,
  )
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.fino\.bank\.in\/company\/careers/i,
  )
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /No Roles Found/i,
  )
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /no trustworthy public jobs surface/i,
  )
  assert.match(
    FINO_PAYMENTS_BANK_CATALOG.verifiedSurfaceSummary,
    /404/i,
  )
  assert.equal(FINO_PAYMENTS_BANK_CATALOG.modulePath, finoPaymentsBankModulePath)

  assert.equal(
    finoPaymentsBank.PROVIDER_METADATA.source,
    FINO_PAYMENTS_BANK_CATALOG.source,
  )
  assert.equal(
    finoPaymentsBank.PROVIDER_METADATA.companyCareerPage,
    FINO_PAYMENTS_BANK_CATALOG.companyCareerPage,
  )
  assert.deepEqual(
    finoPaymentsBank.PROVIDER_METADATA.alternateRouteUrls,
    FINO_PAYMENTS_BANK_CATALOG.alternateRouteUrls,
  )
})
