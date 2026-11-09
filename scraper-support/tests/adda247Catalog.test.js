import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const adda247ModulePath = path.resolve(currentDir, '../../scraper/adda247/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/adda247/catalog.js')
  } catch {
    assert.fail('Expected Adda247 catalog module at ../../scraper/adda247/catalog.js')
  }
}

const loadAdda247Module = async () => {
  try {
    return await import('../../scraper/adda247/script.js')
  } catch {
    assert.fail('Expected Adda247 scraper module at ../../scraper/adda247/script.js')
  }
}

test('Adda247 local catalog captures the verified first-party careers shell and external Keka handoff state', async () => {
  const { ADDA247_CATALOG } = await loadCatalogModule()
  const adda247 = await loadAdda247Module()

  assert.equal(ADDA247_CATALOG.source, 'adda247')
  assert.equal(ADDA247_CATALOG.companyName, 'Adda247')
  assert.equal(ADDA247_CATALOG.adapter, 'script')
  assert.equal(ADDA247_CATALOG.companyCareerPage, 'https://www.adda247.com/careers.html')
  assert.equal(ADDA247_CATALOG.companyDomain, 'adda247.com')
  assert.equal(ADDA247_CATALOG.atsPlatform, 'keka')
  assert.equal(ADDA247_CATALOG.countryFilter, 'India')
  assert.equal(
    ADDA247_CATALOG.paginationStrategy,
    'configured-native-Keka-array+two-public-detail-passes+final-after-details-listing',
  )
  assert.equal(
    ADDA247_CATALOG.extractionStrategy,
    'configured-native-tenant+organization+role-identity;current-corporate-handoff-unverified',
  )
  assert.equal(ADDA247_CATALOG.parser, 'custom-script')
  assert.equal(ADDA247_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ADDA247_CATALOG.verifiedOn, null)
  assert.equal(ADDA247_CATALOG.historicalHandoffVerifiedOn,'2026-07-19')
  assert.equal(ADDA247_CATALOG.corporateHandoffVerified,false)
  assert.equal(ADDA247_CATALOG.lifecycleCleanupAllowed,false)
  assert.equal(ADDA247_CATALOG.externalHandoffUrl, 'https://adda247.kekahire.com/')
  assert.equal(ADDA247_CATALOG.kekaCareersUrl, 'https://adda247.keka.com/careers/')
  assert.equal(
    ADDA247_CATALOG.kekaActiveJobsApiUrl,
    'https://adda247.keka.com/careers/api/jobs/default/active',
  )
  assert.match(ADDA247_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.adda247\.com\/careers\.html/i)
  assert.match(ADDA247_CATALOG.verifiedSurfaceSummary, /https:\/\/adda247\.kekahire\.com\/?/i)
  assert.match(ADDA247_CATALOG.verifiedSurfaceSummary, /adda247\.keka\.com\/careers/i)
  assert.match(ADDA247_CATALOG.verifiedSurfaceSummary, /Full public India jobs/i)
  assert.equal(ADDA247_CATALOG.modulePath, adda247ModulePath)

  assert.equal(adda247.PROVIDER_METADATA.source, ADDA247_CATALOG.source)
  assert.equal(adda247.PROVIDER_METADATA.companyName, ADDA247_CATALOG.companyName)
  assert.equal(
    adda247.PROVIDER_METADATA.companyCareerPage,
    ADDA247_CATALOG.companyCareerPage,
  )
  assert.equal(
    adda247.PROVIDER_METADATA.externalHandoffUrl,
    ADDA247_CATALOG.externalHandoffUrl,
  )
})

test('buildScrapers and company coverage resolve Adda247 from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'adda247')
  const scraper = buildScrapers().find((item) => item.name === 'adda247')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Adda247')
  assert.equal(provider.companyCareerPage, 'https://www.adda247.com/careers.html')
  assert.equal(provider.configuredNativeUrl,'https://adda247.keka.com/careers/')
  assert.equal(provider.sourceCurrentPublicContractReviewedOn,'2026-11-03')
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.corporateHandoffVerified,false)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.match(scraper.dryRunFile, /adda247[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Adda247\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Adda247', 'adda247', 'Adda247']],
  )
})
