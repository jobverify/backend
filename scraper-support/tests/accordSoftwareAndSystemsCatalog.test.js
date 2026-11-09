import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/accordsoftwaresystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/accordsoftwaresystems/catalog.js')
  } catch {
    assert.fail('Expected Accord Software & Systems catalog module at ../../scraper/accordsoftwaresystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/accordsoftwaresystems/script.js')
  } catch {
    assert.fail('Expected Accord Software & Systems scraper module at ../../scraper/accordsoftwaresystems/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Accord Software & Systems local catalog captures the verified first-party careers page and shared apply form', async () => {
  const { ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const accord = await loadScriptModule()
  const provider = buildCatalogReadyProvider(ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'accordsoftwaresystems')
  assert.equal(provider.companyName, 'Accord Software & Systems')
  assert.equal(provider.officialBrandName, 'Accord Software & Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.accord-soft.com/')
  assert.equal(provider.companyCareerPage, 'https://www.accord-soft.com/career.php')
  assert.equal(provider.applyFormUrl, 'https://www.accord-soft.com/career-form.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+shared-first-party-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'accord-soft.com')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, September 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.accord-soft\.com\/career\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.accord-soft\.com\/career-form\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /Embedded Software Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Team Lead- Accounts Payable & Payroll/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /accordsoftwaresystems[\\/]jobs\.json$/i)

  assert.equal(accord.PROVIDER_METADATA.source, provider.source)
  assert.equal(accord.PROVIDER_METADATA.companyName, provider.companyName)
})

test('Accord Software & Systems exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Accord Software & Systems\n',
    catalog: [buildCatalogReadyProvider(ACCORD_SOFTWARE_AND_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Accord Software & Systems', 'accordsoftwaresystems', 'Accord Software & Systems']],
  )
})
