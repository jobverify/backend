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
const modulePath = path.resolve(currentDir, '../../scraper/amnealpharmaceuticalsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amnealpharmaceuticalsindia/catalog.js')
  } catch {
    assert.fail('Expected Amneal Pharmaceuticals India catalog module at ../../scraper/amnealpharmaceuticalsindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/amnealpharmaceuticalsindia/script.js')
  } catch {
    assert.fail('Expected Amneal Pharmaceuticals India scraper module at ../../scraper/amnealpharmaceuticalsindia/script.js')
  }
}

test('Amneal Pharmaceuticals India local catalog captures the verified first-party India careers handoff to Oracle Cloud', async () => {
  const { AMNEAL_PHARMACEUTICALS_INDIA_CATALOG } = await loadCatalogModule()
  const amneal = await loadScriptModule()

  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.source, 'amnealpharmaceuticalsindia')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.companyName, 'Amneal Pharmaceuticals India')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.officialBrandName, 'Amneal India')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.adapter, 'script')
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.companyCareerPage,
    'https://india.amneal.com/careers/search-our-career-opportunities/',
  )
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.companyDomain, 'india.amneal.com')
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.officialCareersPageUrl,
    'https://india.amneal.com/careers/',
  )
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.oracleCandidateExperienceUrl,
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001',
  )
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.workspaceDomain,
    'hcfa.fa.us2.oraclecloud.com',
  )
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.listingApiBaseUrl,
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.detailApiBaseUrl,
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.publicJobsBaseUrl,
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/',
  )
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.siteNumber, 'CX_5001')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.atsPlatform, 'oracle-cloud')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.paginationStrategy, 'offset-query')
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-india-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.normalizationProfile,
    'engineering-default',
  )
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.dryRunFile,
    'amnealpharmaceuticalsindia/jobs.json',
  )
  assert.match(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/india\.amneal\.com\/careers\//i,
  )
  assert.match(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/india\.amneal\.com\/careers\/search-our-career-opportunities\//i,
  )
  assert.match(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/hcfa\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_5001/i,
  )
  assert.match(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedSurfaceSummary,
    /180 India roles/i,
  )
  assert.match(
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.verifiedSurfaceSummary,
    /Deputy Manager \/ Manager - Clinical Trials management/i,
  )
  assert.equal(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.modulePath, modulePath)

  assert.equal(
    amneal.PROVIDER_METADATA.source,
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.source,
  )
  assert.equal(
    amneal.PROVIDER_METADATA.companyName,
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.companyName,
  )
  assert.equal(
    amneal.PROVIDER_METADATA.oracleCandidateExperienceUrl,
    AMNEAL_PHARMACEUTICALS_INDIA_CATALOG.oracleCandidateExperienceUrl,
  )
})

test('Amneal Pharmaceuticals India local catalog hydrates into coverage without needing a shared alias entry', async () => {
  const { AMNEAL_PHARMACEUTICALS_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMNEAL_PHARMACEUTICALS_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Amneal Pharmaceuticals India')
  assert.equal(provider.companyDomain, 'india.amneal.com')
  assert.match(provider.modulePath, /amnealpharmaceuticalsindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /amnealpharmaceuticalsindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amneal Pharmaceuticals India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amneal Pharmaceuticals India', 'amnealpharmaceuticalsindia', 'Amneal Pharmaceuticals India']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Amneal Pharmaceuticals India'),
    false,
  )
})

test('buildScrapers and company coverage resolve Amneal Pharmaceuticals India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amnealpharmaceuticalsindia')
  const scraper = buildScrapers().find((item) => item.name === 'amnealpharmaceuticalsindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amneal Pharmaceuticals India')
  assert.equal(
    provider.companyCareerPage,
    'https://india.amneal.com/careers/search-our-career-opportunities/',
  )
  assert.match(scraper.dryRunFile, /amnealpharmaceuticalsindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amneal Pharmaceuticals India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amneal Pharmaceuticals India', 'amnealpharmaceuticalsindia', 'Amneal Pharmaceuticals India']],
  )
})
