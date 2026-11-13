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

test('Airtel Payments Bank metadata preserves the exact employer feed and company-wide cleanup hold', async () => {
  const { AIRTEL_PAYMENTS_BANK_CATALOG } = await loadCatalogModule()
  const airtel = await loadAirtelPaymentsBankModule()
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.source, 'airtelpaymentsbank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.companyName, 'Airtel Payments Bank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.companyCareerPage, 'https://www.airtelpayments.bank.in/')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.employerProfileUrl, 'https://www.linkedin.com/company/airtelpaymentsbank')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.employerCompanyId, '13361480')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.countryFilter, 'India')
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.sourceScopeComplete, false)
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.lifecycleCleanupAllowed, false)
  assert.equal(AIRTEL_PAYMENTS_BANK_CATALOG.modulePath, airtelPaymentsBankModulePath)
  assert.equal(airtel.PROVIDER_METADATA, AIRTEL_PAYMENTS_BANK_CATALOG)
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
  assert.equal(provider.paginationStrategy, 'exact-employer-worldwide-count-and-terminal+stable-closing-inventory;max-100-native-rows')
  assert.equal(provider.extractionStrategy, 'corporate-employer-handoff+reciprocal-bank-website+native-JobPosting-and-full-visible-criteria-parity+explicit-country+same-role-account-handoff;whole-company-scope-unverified')
  assert.equal(provider.verifiedOn, '2026-11-13')
  assert.equal(provider.employerCompanyId, '13361480')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.verifiedSurfaceSummary, /company-wide totals remain unknown and lifecycle cleanup is forbidden/i)
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
