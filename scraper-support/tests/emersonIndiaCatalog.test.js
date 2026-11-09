import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/emersonindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/emersonindia/catalog.js')
  } catch {
    assert.fail('Expected Emerson India catalog module at ../../scraper/emersonindia/catalog.js')
  }
}

test('Emerson India catalog captures the verified first-party careers handoff to Oracle Cloud', async () => {
  const { EMERSON_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, EMERSON_INDIA_CATALOG)
  assert.equal(EMERSON_INDIA_CATALOG.source, 'emersonindia')
  assert.equal(EMERSON_INDIA_CATALOG.companyName, 'Emerson India')
  assert.equal(EMERSON_INDIA_CATALOG.officialBrandName, 'Emerson')
  assert.equal(EMERSON_INDIA_CATALOG.adapter, 'script')
  assert.equal(
    EMERSON_INDIA_CATALOG.companyCareerPage,
    'https://www.emerson.com/en/corporate/careers',
  )
  assert.equal(EMERSON_INDIA_CATALOG.companyDomain, 'emerson.com')
  assert.equal(
    EMERSON_INDIA_CATALOG.oracleCandidateExperienceUrl,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  )
  assert.equal(EMERSON_INDIA_CATALOG.workspaceDomain, 'hdjq.fa.us2.oraclecloud.com')
  assert.equal(
    EMERSON_INDIA_CATALOG.listingApiBaseUrl,
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    EMERSON_INDIA_CATALOG.detailApiBaseUrl,
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    EMERSON_INDIA_CATALOG.publicJobsBaseUrl,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(EMERSON_INDIA_CATALOG.siteNumber, 'CX_1')
  assert.equal(EMERSON_INDIA_CATALOG.atsPlatform, 'oracle-cloud')
  assert.equal(EMERSON_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(EMERSON_INDIA_CATALOG.paginationStrategy, 'offset-query')
  assert.equal(
    EMERSON_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(EMERSON_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(EMERSON_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EMERSON_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(EMERSON_INDIA_CATALOG.dryRunFile, 'emersonindia/jobs.json')
  assert.match(
    EMERSON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.emerson\.com\/en\/corporate\/careers/i,
  )
  assert.match(
    EMERSON_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/hdjq\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_1/i,
  )
  assert.match(EMERSON_INDIA_CATALOG.verifiedSurfaceSummary, /\b146 India roles\b/i)
  assert.match(EMERSON_INDIA_CATALOG.verifiedSurfaceSummary, /Analyst I Finance/i)
  assert.equal(EMERSON_INDIA_CATALOG.modulePath, modulePath)
})
