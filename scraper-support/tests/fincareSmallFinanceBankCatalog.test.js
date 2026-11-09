import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fincaresmallfinancebank/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fincaresmallfinancebank/catalog.js')
  } catch {
    assert.fail('Expected Fincare Small Finance Bank catalog module at ../../scraper/fincaresmallfinancebank/catalog.js')
  }
}

test('Fincare Small Finance Bank catalog captures the verified merged-brand redirect surface', async () => {
  const {
    FINCARE_SMALL_FINANCE_BANK_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, FINCARE_SMALL_FINANCE_BANK_CATALOG)
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.source, 'fincaresmallfinancebank')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.companyName, 'Fincare Small Finance Bank')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.officialBrandName, 'Fincare Small Finance Bank')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.adapter, 'script')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.companyCareerPage, 'https://www.fincarebank.com/')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.legacyHomepageUrl, 'https://www.fincarebank.com/')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.legacyHomepageNoWwwUrl, 'https://fincarebank.com/')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.mergedParentHomepageUrl, 'https://www.au.bank.in/')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.atsPlatform, 'legacy-brand-redirect-to-au-bank-homepage')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.countryFilter, 'India')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.paginationStrategy, 'legacy-homepage-redirect-validation')
  assert.equal(
    FINCARE_SMALL_FINANCE_BANK_CATALOG.extractionStrategy,
    'verified-legacy-fincare-domains-redirect-to-au-homepage-without-fincare-jobs-return-empty',
  )
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.parser, 'custom-script')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.companyDomain, 'fincarebank.com')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FINCARE_SMALL_FINANCE_BANK_CATALOG.modulePath, modulePath)
  assert.match(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.fincarebank\.com\//i)
  assert.match(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/fincarebank\.com\//i)
  assert.match(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.au\.bank\.in\//i)
  assert.match(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /Fincare NetBanking/i)
  assert.match(FINCARE_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Fincare Small Finance Bank backlog matching works directly from the local catalog metadata without an alias', async () => {
  const { FINCARE_SMALL_FINANCE_BANK_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Fincare Small Finance Bank\n',
    catalog: [FINCARE_SMALL_FINANCE_BANK_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fincare Small Finance Bank', 'fincaresmallfinancebank', 'Fincare Small Finance Bank']],
  )
})
